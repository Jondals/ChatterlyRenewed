/**
 * src/app/core/services/receipt.service.ts
 * Delivery and read marks (the "sent, delivered, read" state under your messages). It tells the server what
 * this device has received and read, listens for the same from the other people and works out the state of
 * each message of yours. Reading is only reported when the person allows it in the privacy settings, and in
 * exchange the "read" state of other people is not shown to someone who does not share their own.
 */
import { Injectable, inject, signal } from '@angular/core';
import { GuildStore } from '../../store/guild.store';
import { E2eeService } from '../../store/e2ee.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';
import { SocketService } from './socket.service';

/** State of one of your messages. */
export type MessageStatus = 'sent' | 'delivered' | 'read';

/** The highest message numbers one person has received and read in a channel. */
export interface ReceiptMark {
  delivered: number;
  read: number;
}

/** Waits this long (ms) before sending a mark, so a burst of messages produces a single request. */
const SEND_DELAY = 250;

/** Keeps the delivery and read marks of every conversation. */
@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly e2ee = inject(E2eeService);
  private readonly guilds = inject(GuildStore);
  private readonly settings = inject(SettingsService);
  private readonly socket = inject(SocketService);

  /** Marks of the other people: channel id, then user id. */
  readonly marks = signal<Record<string, Record<string, ReceiptMark>>>({});

  private started = false;
  private readonly timers = new Map<string, number>();
  private readonly waiting = new Map<string, ReceiptMark>();

  /** Starts listening for the marks other people send. Safe to call more than once. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.socket.events$.subscribe(this.onSocketEvent.bind(this));
  }

  /** Forgets everything (on sign out). */
  reset(): void {
    this.marks.set({});
    this.waiting.clear();
    for (const timer of this.timers.values()) {
      window.clearTimeout(timer);
    }
    this.timers.clear();
  }

  /** Reacts to a "receipt" event from the server. */
  private onSocketEvent(event: { t: string }): void {
    if (event.t !== 'receipt') {
      return;
    }
    const data = event as unknown as {
      channelId: string;
      userId: string;
      delivered: number;
      read: number;
    };
    this.setMark(data.channelId, data.userId, { delivered: data.delivered, read: data.read });
  }

  /** Stores the mark of one person in one channel (marks only ever grow). */
  private setMark(channelId: string, userId: string, mark: ReceiptMark): void {
    const all = this.marks();
    const channel = all[channelId] ?? {};
    const old = channel[userId];
    const merged: ReceiptMark = {
      delivered: Math.max(old ? old.delivered : 0, mark.delivered),
      read: Math.max(old ? old.read : 0, mark.read),
    };
    this.marks.set({ ...all, [channelId]: { ...channel, [userId]: merged } });
  }

  /** Loads the marks other people already have in a channel (when the conversation is opened). */
  async load(channelId: string): Promise<void> {
    const response = await this.api.get<{
      receipts: { userId: string; delivered: number; read: number }[];
    }>('/api/channels/' + channelId + '/receipts');
    for (const item of response.receipts) {
      this.setMark(channelId, item.userId, { delivered: item.delivered, read: item.read });
    }
  }

  /**
   * Says that this device has received messages up to `seq` in a channel and, when the conversation is on
   * screen (`visible`) and the person allows it, that it has also read them.
   */
  seen(channelId: string, seq: number, visible: boolean): void {
    if (seq <= 0) {
      return;
    }
    const read = visible && this.settings.sendReadReceipts() ? seq : 0;
    const previous = this.waiting.get(channelId);
    this.waiting.set(channelId, {
      delivered: Math.max(previous ? previous.delivered : 0, seq),
      read: Math.max(previous ? previous.read : 0, read),
    });
    if (!this.timers.has(channelId)) {
      this.timers.set(channelId, window.setTimeout(this.flush.bind(this, channelId), SEND_DELAY));
    }
  }

  /** Sends the waiting mark of a channel to the server. */
  private flush(channelId: string): void {
    this.timers.delete(channelId);
    const mark = this.waiting.get(channelId);
    this.waiting.delete(channelId);
    if (!mark) {
      return;
    }
    const body: { delivered: number; read?: number } = { delivered: mark.delivered };
    if (mark.read > 0) {
      body.read = mark.read;
    }
    this.api.post('/api/channels/' + channelId + '/receipt', body).catch(this.ignoreError);
  }

  /** A mark that could not be sent is not worth bothering the person with. */
  private ignoreError(): void {
    return;
  }

  /** The people who should receive a message sent in a channel (everybody except you). */
  private recipientsOf(channelId: string): string[] {
    const ref = this.e2ee.refFor(channelId);
    if (!ref) {
      return [];
    }
    if (ref.kind === 'dm') {
      return [ref.otherUserId];
    }
    const guild = this.guilds.guild(ref.guildId);
    const me = this.auth.userId;
    const people: string[] = [];
    if (guild) {
      for (const member of guild.members) {
        if (member.userId !== me) {
          people.push(member.userId);
        }
      }
    }
    return people;
  }

  /** State of one of your messages: sent, delivered to everybody or read by everybody. */
  statusOf(channelId: string, seq: number, pending: boolean): MessageStatus {
    const people = this.recipientsOf(channelId);
    if (pending || people.length === 0) {
      return 'sent';
    }
    const channel = this.marks()[channelId] ?? {};
    let delivered = true;
    let read = true;
    for (const id of people) {
      const mark = channel[id];
      if (!mark || mark.delivered < seq) {
        delivered = false;
      }
      if (!mark || mark.read < seq) {
        read = false;
      }
    }
    if (read && this.settings.sendReadReceipts()) {
      return 'read';
    }
    return delivered || read ? 'delivered' : 'sent';
  }
}
