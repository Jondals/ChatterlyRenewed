/**
 * src/ws/hub.ts
 * Registry of WebSocket connections, presence and call rooms; it delivers the events to whoever should get them.
 */
import type { Db } from '../db';
import { presenceAudience } from '../models';

export type Presence = 'online' | 'idle' | 'dnd' | 'invisible';
export type PublicPresence = 'online' | 'idle' | 'dnd' | 'offline';

export interface Client {
  id: string;
  userId: string;
  send(message: unknown): void;
  close(code?: number, reason?: string): void;
}

export interface Participant {
  userId: string;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
  joinedAt: number;
}

export const MAX_ROOM_SIZE = 8; // full-mesh P2P: every extra peer adds an upstream per participant.

/** The most connections (tabs, devices) one person can keep open at once. */
const MAX_CONNECTIONS_PER_USER = 8;

/**
 * Tracks live sockets, presence and call rooms. It never inspects payloads of `rtc.signal`
 * messages: those are end-to-end encrypted between peers.
 */
export class Hub {
  private readonly clients = new Map<string, Set<Client>>();
  private readonly statuses = new Map<string, Presence>();
  private readonly rooms = new Map<string, Map<string, Participant>>();
  private readonly userRoom = new Map<string, string>();

  private closed = false;

  constructor(private readonly db: Db) {}

  /** Disconnects everyone; later detach/broadcast calls become no-ops (the DB is about to close). */
  shutdown(): void {
    this.closed = true;
    for (const set of this.clients.values())
      for (const client of set) client.close(1001, 'server shutting down');
    this.clients.clear();
    this.rooms.clear();
    this.userRoom.clear();
  }

  // ---- connections -------------------------------------------------------------------------

  attach(client: Client): void {
    const set = this.clients.get(client.userId) ?? new Set<Client>();
    const first = set.size === 0;
    // A person has a few open tabs, not hundreds: the oldest connection leaves when there are too many.
    while (set.size >= MAX_CONNECTIONS_PER_USER) {
      const oldest = set.values().next().value as Client;
      set.delete(oldest);
      oldest.close(4429, 'too many connections');
    }
    set.add(client);
    this.clients.set(client.userId, set);
    if (first) this.broadcastPresence(client.userId);
  }

  /** A connection closed: when it was the last one of the person they go offline and leave their call. */
  detach(client: Client): void {
    if (this.closed) return;
    const set = this.clients.get(client.userId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) {
      this.clients.delete(client.userId);
      this.leaveRoom(client.userId);
      this.statuses.delete(client.userId);
      this.broadcastPresence(client.userId);
    }
  }

  /** Closes every connection of a person (their account was erased) and takes them out of their call. */
  dropUser(userId: string): void {
    this.leaveRoom(userId);
    for (const client of [...(this.clients.get(userId) ?? [])])
      client.close(4401, 'account deleted');
  }

  /** Whether a person has any connection open. */
  isOnline(userId: string): boolean {
    return this.clients.has(userId);
  }

  /** How many connections are open. */
  connectionCount(): number {
    let n = 0;
    for (const set of this.clients.values()) n += set.size;
    return n;
  }

  /** Sends a message to every connection of a person (their tabs and devices). */
  sendTo(userId: string, message: unknown): void {
    const set = this.clients.get(userId);
    if (!set) return;
    for (const client of set) client.send(message);
  }

  /** Sends a message to several people, except one if asked. */
  sendToMany(userIds: Iterable<string>, message: unknown, except?: string): void {
    for (const id of userIds) if (id !== except) this.sendTo(id, message);
  }

  // ---- presence ----------------------------------------------------------------------------

  setStatus(userId: string, status: Presence): void {
    if (!this.clients.has(userId)) return;
    this.statuses.set(userId, status);
    this.broadcastPresence(userId);
  }

  /** What other people get to see: invisible looks offline. */
  presenceOf(userId: string): PublicPresence {
    if (!this.clients.has(userId)) return 'offline';
    const status = this.statuses.get(userId) ?? 'online';
    return status === 'invisible' ? 'offline' : status;
  }

  /** The presence of everybody who may see the person, to send it when they connect. */
  snapshotFor(userId: string): { userId: string; status: PublicPresence }[] {
    return presenceAudience(this.db, userId)
      .map(
        function (this: Hub, id: string) {
          return { userId: id, status: this.presenceOf(id) };
        }.bind(this),
      )
      .filter(function (p) {
        return p.status !== 'offline';
      });
  }

  /** Tells everybody who may see a person that their presence changed. */
  private broadcastPresence(userId: string): void {
    const message = { t: 'presence', userId, status: this.presenceOf(userId) };
    this.sendToMany(presenceAudience(this.db, userId), message);
    // The user's other devices should also reflect the new state.
    this.sendTo(userId, message);
  }

  // ---- call rooms --------------------------------------------------------------------------

  activeRoomIds(): string[] {
    return [...this.rooms.keys()];
  }

  /** Who is in a call room. */
  participants(roomId: string): Participant[] {
    return [...(this.rooms.get(roomId)?.values() ?? [])];
  }

  /** The room a person is in. */
  roomOf(userId: string): string | undefined {
    return this.userRoom.get(userId);
  }

  /** Whether two people are in the same room: calls only relay signals between them. */
  inSameRoom(roomId: string, a: string, b: string): boolean {
    const room = this.rooms.get(roomId);
    return !!room && room.has(a) && room.has(b);
  }

  /** Returns false when the room is full. Leaves any previous room first. */
  joinRoom(roomId: string, userId: string): { ok: boolean; previousRoom?: string } {
    const existing = this.rooms.get(roomId);
    if (existing && !existing.has(userId) && existing.size >= MAX_ROOM_SIZE) return { ok: false };
    const previous = this.userRoom.get(userId);
    if (previous && previous !== roomId) this.leaveRoom(userId);
    const room = existing ?? new Map<string, Participant>();
    room.set(userId, {
      userId,
      muted: false,
      deafened: false,
      video: false,
      screen: false,
      joinedAt: Date.now(),
    });
    this.rooms.set(roomId, room);
    this.userRoom.set(userId, roomId);
    return {
      ok: true,
      previousRoom: previous && previous !== roomId ? previous : undefined,
    };
  }

  updateParticipant(
    roomId: string,
    userId: string,
    patch: Partial<Pick<Participant, 'muted' | 'deafened' | 'video' | 'screen'>>,
  ): boolean {
    const participant = this.rooms.get(roomId)?.get(userId);
    if (!participant) return false;
    Object.assign(participant, patch);
    return true;
  }

  /** Removes the user from their room; returns the room id they left (if any). */
  leaveRoom(userId: string): string | undefined {
    const roomId = this.userRoom.get(userId);
    if (!roomId) return undefined;
    this.userRoom.delete(userId);
    const room = this.rooms.get(roomId);
    room?.delete(userId);
    if (room && room.size === 0) this.rooms.delete(roomId);
    this.onRoomChange?.(roomId);
    return roomId;
  }

  /** Set by the socket layer so room changes are announced to the right audience. */
  onRoomChange?: (roomId: string) => void;
}
