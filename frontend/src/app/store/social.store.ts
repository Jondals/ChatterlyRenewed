/**
 * src/app/store/social.store.ts
 * Estado social: amigos, solicitudes, mensajes directos y presencia.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import type { DmSummary, PresenceStatus, SelfPresence, User } from '../core/models';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { DirectoryService } from '../core/services/directory.service';
import { SocketService } from '../core/services/socket.service';

interface FriendsResponse {
  friends: string[];
  incoming: string[];
  outgoing: string[];
  users: User[];
}

/** Friends, direct-message conversations and presence. */
@Injectable({ providedIn: 'root' })
export class SocialStore {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly directory = inject(DirectoryService);
  private readonly socket = inject(SocketService);

  readonly friends = signal<string[]>([]);
  readonly incoming = signal<string[]>([]);
  readonly outgoing = signal<string[]>([]);
  readonly dms = signal<DmSummary[]>([]);
  readonly presence = signal<ReadonlyMap<string, PresenceStatus>>(new Map());
  readonly selfStatus = signal<SelfPresence>('online');
  readonly loaded = signal(false);

  readonly friendUsers = computed(
    function (this: SocialStore) {
      return this.resolve(this.friends());
    }.bind(this),
  );
  readonly incomingUsers = computed(
    function (this: SocialStore) {
      return this.resolve(this.incoming());
    }.bind(this),
  );
  readonly outgoingUsers = computed(
    function (this: SocialStore) {
      return this.resolve(this.outgoing());
    }.bind(this),
  );
  readonly onlineFriends = computed(
    function (this: SocialStore) {
      return this.friendUsers().filter(
        function (this: SocialStore, u: User) {
          return this.statusOf(u.id) !== 'offline';
        }.bind(this),
      );
    }.bind(this),
  );

  private started = false;

  /** The users of some ids, skipping those not known yet. */
  private resolve(ids: string[]): User[] {
    const users = this.directory.users();
    return ids
      .map(function (id) {
        return users.get(id);
      })
      .filter(function (u): u is User {
        return !!u;
      });
  }

  /** The presence of a person; the own one is the one the person chose (invisible shows as offline). */
  statusOf(userId: string): PresenceStatus {
    if (userId === this.auth.user()?.id) {
      const own = this.selfStatus();
      return own === 'invisible' ? 'offline' : own;
    }
    return this.presence().get(userId) ?? 'offline';
  }

  /** The direct chat with a user, if there is one. */
  dmForUser(userId: string): DmSummary | undefined {
    return this.dms().find(function (d) {
      return d.userId === userId;
    });
  }

  /** The direct chat of a channel id. */
  dmByChannel(channelId: string): DmSummary | undefined {
    return this.dms().find(function (d) {
      return d.channelId === channelId;
    });
  }

  /** Subscribes to realtime events. Safe to call repeatedly. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.socket.events$.subscribe(
      function (
        this: SocialStore,
        event: import('D:/dev/ChatterlyRenewed/frontend/src/app/core/services/socket.service').ServerEvent,
      ) {
        const e = event as unknown as Record<string, unknown>;
        switch (event.t) {
          case 'ready':
            this.presence.set(new Map());
            this.applyPresence(e['presence'] as { userId: string; status: PresenceStatus }[]);
            void this.refresh();
            break;
          case 'presence':
            this.applyPresence([e as unknown as { userId: string; status: PresenceStatus }]);
            break;
          case 'friends.update':
            void this.refresh();
            break;
          case 'guild.update':
            void this.refreshPresence();
            break;
          case 'user.update':
            this.directory.merge([e['user'] as User]);
            if ((e['user'] as User).id === this.auth.user()?.id)
              this.auth.setUser(e['user'] as User);
            break;
        }
      }.bind(this),
    );
  }

  /** Forgets friends, requests and chats (sign out). */
  reset(): void {
    this.friends.set([]);
    this.incoming.set([]);
    this.outgoing.set([]);
    this.dms.set([]);
    this.presence.set(new Map());
    this.loaded.set(false);
  }

  /** Applies the presence the server sent (who is online, away...). */
  private applyPresence(list: { userId: string; status: PresenceStatus }[]): void {
    this.presence.update(function (current) {
      const next = new Map(current);
      for (const { userId, status } of list) {
        if (status === 'offline') next.delete(userId);
        else next.set(userId, status);
      }
      return next;
    });
  }

  /** Loads friends, requests and direct chats. */
  async refresh(): Promise<void> {
    const [friends, dms] = await Promise.all([
      this.api.get<FriendsResponse>('/api/friends'),
      this.api.get<{ dms: DmSummary[]; users: User[] }>('/api/dms'),
    ]);
    this.directory.merge([...friends.users, ...dms.users]);
    this.friends.set(friends.friends);
    this.incoming.set(friends.incoming);
    this.outgoing.set(friends.outgoing);
    this.dms.set(dms.dms);
    this.loaded.set(true);
    void this.refreshPresence();
  }

  /** New friends / guild mates were not around when their presence was first broadcast. */
  async refreshPresence(): Promise<void> {
    try {
      const res = await this.api.get<{ presence: { userId: string; status: PresenceStatus }[] }>(
        '/api/presence',
      );
      this.applyPresence(res.presence);
    } catch {
      /* presence is best-effort */
    }
  }

  /** Sends a friend request (it is accepted at once when the other person had already asked). */
  async sendRequest(username: string): Promise<'pending' | 'accepted'> {
    const res = await this.api.post<{ status: 'pending' | 'accepted' }>('/api/friends/request', {
      username,
    });
    await this.refresh();
    return res.status;
  }

  /** Accepts a friend request. */
  async accept(userId: string): Promise<void> {
    await this.api.post(`/api/friends/${userId}/accept`);
    await this.refresh();
  }

  /** Removes a friend or cancels a request. */
  async remove(userId: string): Promise<void> {
    await this.api.delete(`/api/friends/${userId}`);
    await this.refresh();
  }

  /** Opens (or creates) the direct chat with a friend and returns its id. */
  async openDm(userId: string): Promise<string> {
    const existing = this.dmForUser(userId);
    if (existing) return existing.channelId;
    const res = await this.api.post<{ channelId: string }>('/api/dms', { userId });
    await this.refresh();
    return res.channelId;
  }

  /** Changes the own presence and tells the server. */
  setSelfStatus(status: SelfPresence): void {
    this.selfStatus.set(status);
    this.socket.send({ t: 'presence.set', status });
  }

  /** Looks for users by name to add them as friends. */
  async searchUsers(query: string): Promise<User[]> {
    const res = await this.api.get<{ users: User[] }>(
      `/api/users/search?q=${encodeURIComponent(query)}`,
    );
    this.directory.merge(res.users);
    return res.users;
  }
}
