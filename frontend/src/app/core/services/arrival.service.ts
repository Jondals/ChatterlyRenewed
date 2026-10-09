/**
 * src/app/core/services/arrival.service.ts
 * The moments of arriving in the app: the introduction the very first time, the transition after signing in, the
 * celebration after creating an account and the goodbye when signing out. This file only decides when they play and tells the caller when the
 * page underneath may change; the animations themselves live in a component that is loaded only when needed.
 */
import { Injectable, signal } from '@angular/core';

/** Which animation plays. */
export type ArrivalKind = 'intro' | 'login' | 'register' | 'logout';

/** The animation that is on screen and the name of the person it greets. */
export interface Arrival {
  kind: ArrivalKind;
  name: string;
}

/** Key that remembers that the introduction was already seen on this device. */
const SEEN_KEY = 'chatterly.intro2';
/** The longest the caller waits for the animation to reach its reveal point (if the component fails to load). */
const GIVE_UP_MS = 4000;

/** Plays the arrival animations and says when the page underneath can change. */
@Injectable({ providedIn: 'root' })
export class ArrivalService {
  /** The animation on screen, or null. */
  readonly current = signal<Arrival | null>(null);
  private waiting: (() => void) | null = null;
  private giveUp: ReturnType<typeof setTimeout> | undefined;

  /**
   * Whether animations are wanted: not for people who asked for no motion, and not for automatic browsers (tests,
   * audits), which would only be slowed down by them (unless `chatterly.motion` is set to look at them).
   */
  private wanted(): boolean {
    const automatic = navigator.webdriver && !localStorage.getItem('chatterly.motion');
    return (
      !automatic &&
      document.documentElement.dataset['motion'] !== 'reduced' &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Starts an animation. The promise ends when the page underneath may change (the animation covers the change). */
  play(kind: ArrivalKind, name = ''): Promise<void> {
    if (!this.wanted()) {
      return Promise.resolve();
    }
    this.current.set({ kind, name });
    return new Promise<void>(this.keepResolver.bind(this));
  }

  /** Keeps the way to end the wait, and gives up after a while so nobody waits for ever. */
  private keepResolver(resolve: () => void): void {
    this.waiting = resolve;
    clearTimeout(this.giveUp);
    this.giveUp = setTimeout(this.reveal.bind(this), GIVE_UP_MS);
  }

  /** The animation reached the point where the page underneath can change. */
  reveal(): void {
    clearTimeout(this.giveUp);
    this.waiting?.();
    this.waiting = null;
  }

  /** The animation ended. */
  finish(): void {
    this.reveal();
    this.current.set(null);
  }

  /** The very first time on this device (and only when nobody is signed in) the introduction plays. */
  maybeIntro(): void {
    if (!this.wanted()) {
      return;
    }
    try {
      if (localStorage.getItem(SEEN_KEY) || localStorage.getItem('chatterly.session')) {
        return;
      }
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      return;
    }
    void this.play('intro');
  }
}
