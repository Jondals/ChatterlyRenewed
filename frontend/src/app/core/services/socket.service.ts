/**
 * src/app/core/services/socket.service.ts
 * WebSocket connection to the server with automatic reconnection and delivery of the events it sends.
 */
import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { WS_URL } from '../config';
import { AuthService } from './auth.service';

/** Anything the server sends: an object with a type. */
export interface ServerEvent {
  t: string;
}

export type SocketStatus = 'offline' | 'connecting' | 'online';

/** Close code the server uses when it rejects the access token. */
const TOKEN_REJECTED = 4401;
/** Longest wait between reconnection attempts, in milliseconds. */
const MAX_BACKOFF = 15_000;
/** Time between latency measurements, in milliseconds. */
const PING_INTERVAL = 5000;

/**
 * Realtime channel. It authenticates with a first `auth` frame (the token never appears in the URL or in
 * server logs), reconnects with exponential backoff and measures the round-trip latency.
 */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);

  readonly status = signal<SocketStatus>('offline');
  /** Round trip to the server in ms (smoothed), or null while offline. */
  readonly latency = signal<number | null>(null);

  private readonly subject = new Subject<ServerEvent>();
  readonly events$: Observable<ServerEvent> = this.subject.asObservable();

  private socket: WebSocket | null = null;
  private wanted = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  /** Reconnects when the page becomes visible or the network comes back. */
  constructor() {
    document.addEventListener('visibilitychange', this.reconnectIfNeeded.bind(this));
    window.addEventListener('online', this.reconnectIfNeeded.bind(this));
  }

  /** Reconnects right away when the page comes back (visible or online) and the connection was lost. */
  private reconnectIfNeeded(): void {
    if (!document.hidden && this.wanted && this.status() === 'offline') {
      void this.openNow();
    }
  }

  /** Starts keeping the connection open. */
  connect(): void {
    this.wanted = true;
    if (!this.socket) {
      void this.openNow();
    }
  }

  /** Closes the connection and stops reconnecting. */
  disconnect(): void {
    this.wanted = false;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    this.socket?.close(1000);
    this.socket = null;
    this.status.set('offline');
    this.latency.set(null);
  }

  /** Sends a message; false when the connection is not open. */
  send(message: object): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify(message));
    return true;
  }

  /** Opens the connection now: gets a token, connects and authenticates. */
  private async openNow(): Promise<void> {
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      return;
    }
    this.status.set('connecting');
    const token = await this.auth.getAccessToken();
    if (!token || !this.wanted) {
      this.status.set('offline');
      return;
    }
    const socket = new WebSocket(WS_URL);
    this.socket = socket;
    socket.onopen = this.onOpen.bind(this, socket, token);
    socket.onmessage = this.onMessage.bind(this);
    socket.onclose = this.onClose.bind(this, socket);
    socket.onerror = this.onError.bind(this, socket);
  }

  /** The connection opened: the first frame carries the token. */
  private onOpen(socket: WebSocket, token: string): void {
    socket.send(JSON.stringify({ t: 'auth', token }));
  }

  /** A frame arrived: handle the connection ones (ready, pong) and pass the rest on. */
  private onMessage(event: MessageEvent): void {
    let message: ServerEvent;
    try {
      message = JSON.parse(event.data as string) as ServerEvent;
    } catch {
      return;
    }
    if (message.t === 'ready') {
      this.attempt = 0;
      this.status.set('online');
      this.startPing();
    } else if (message.t === 'pong') {
      this.recordLatency((message as ServerEvent & { ts: number | null }).ts);
      return;
    }
    this.subject.next(message);
  }

  /** Smooths the latency with each new measurement. */
  private recordLatency(sentAt: number | null): void {
    if (typeof sentAt !== 'number') {
      return;
    }
    const round = performance.now() - sentAt;
    const previous = this.latency();
    this.latency.set(
      previous === null ? Math.round(round) : Math.round(previous * 0.6 + round * 0.4),
    );
  }

  /** The connection closed: tell the others and plan a new attempt. */
  private onClose(socket: WebSocket, event: CloseEvent): void {
    if (this.socket !== socket) {
      return;
    }
    this.socket = null;
    clearInterval(this.pingTimer);
    this.status.set('offline');
    this.latency.set(null);
    this.subject.next({ t: 'socket.closed' });
    if (!this.wanted) {
      return;
    }
    if (event.code === TOKEN_REJECTED) {
      // Token rejected: force one refresh; if that fails the session is gone.
      void this.auth.getAccessToken(true).then(this.retryAfterRefresh.bind(this));
      return;
    }
    this.schedule(Math.min(MAX_BACKOFF, 800 * 2 ** this.attempt++));
  }

  /** After a forced token refresh: reconnect at once when a fresh token was obtained. */
  private retryAfterRefresh(fresh: string | null): void {
    if (fresh) {
      this.schedule(0);
    }
  }

  /** On a connection error the socket is closed, which triggers the normal reconnection. */
  private onError(socket: WebSocket): void {
    socket.close();
  }

  /** Plans a connection attempt after a delay. */
  private schedule(delay: number): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(this.openNow.bind(this), delay);
  }

  /** Sends a ping now and then to measure the latency and keep the connection alive. */
  private startPing(): void {
    clearInterval(this.pingTimer);
    const ping = this.sendPing.bind(this);
    ping();
    this.pingTimer = setInterval(ping, PING_INTERVAL);
  }

  /** Sends one ping. */
  private sendPing(): void {
    this.send({ t: 'ping', ts: performance.now() });
  }
}
