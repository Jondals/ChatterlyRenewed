/**
 * src/app/shared/components/arrival.component.ts
 * The animations of arriving in the app, drawn over everything: the introduction of the first visit, the wipe that
 * opens the app after signing in and the celebration after creating an account. It is loaded only when one plays.
 * Everything is CSS and SVG (no pictures), so it costs almost nothing to download.
 */
import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { ArrivalService, type ArrivalKind } from '../../core/services/arrival.service';

/** For each kind: when the page underneath may change, when the animation starts to leave and when it is gone (ms). */
const TIMELINE: Record<ArrivalKind, { reveal: number; leave: number; end: number }> = {
  intro: { reveal: 0, leave: 2900, end: 3500 },
  login: { reveal: 800, leave: 1250, end: 1750 },
  register: { reveal: 1900, leave: 2500, end: 3000 },
};

/** The animation of an arrival. */
@Component({
  selector: 'app-arrival',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div
      class="arr"
      [class]="'arr-' + kind()"
      [class.is-leaving]="leaving()"
      role="status"
      aria-live="polite"
      (click)="skip()"
    >
      <div class="arr-stage">
        @switch (kind()) {
          @case ('intro') {
            <span class="arr-ring"></span><span class="arr-ring r2"></span
            ><span class="arr-ring r3"></span>
            <svg class="arr-mark" viewBox="0 0 64 64" aria-hidden="true">
              <path
                class="draw"
                pathLength="1"
                d="M12 12h40a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H30l-10 9v-9h-8a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"
              />
              <rect class="lock-body" x="25" y="23" width="14" height="11" rx="3" />
              <path class="lock-shackle" d="M28 23v-3a4 4 0 0 1 8 0v3" />
            </svg>
            <h1 class="arr-title" aria-label="Chatterly-Renewed">
              @for (letter of letters; track $index) {
                <span [style.--i]="$index">{{ letter }}</span>
              }
            </h1>
            <p class="arr-tag">{{ 'Private by design' | t }}</p>
            <span class="arr-skip">{{ 'Click to skip' | t }}</span>
          }
          @case ('login') {
            <svg class="arr-lock" viewBox="0 0 64 64" aria-hidden="true">
              <circle class="ring" cx="32" cy="32" r="29" pathLength="1" />
              <rect class="lock-body" x="21" y="29" width="22" height="17" rx="4" />
              <path class="lock-shackle" d="M25 29v-5a7 7 0 0 1 14 0v5" />
            </svg>
            <p class="arr-line a">{{ 'Unlocking your keys…' | t }}</p>
            <p class="arr-line b">{{ 'Welcome back, {name}' | t: { name: name() } }}</p>
          }
          @case ('register') {
            <span class="arr-burst" aria-hidden="true">
              @for (piece of confetti; track $index) {
                <i
                  [style.--a]="piece.angle"
                  [style.--d]="piece.distance"
                  [style.--c]="piece.color"
                  [style.animation-delay]="piece.delay"
                ></i>
              }
            </span>
            <svg class="arr-lock" viewBox="0 0 64 64" aria-hidden="true">
              <circle class="ring done" cx="32" cy="32" r="29" pathLength="1" />
              <path class="tick" pathLength="1" d="M19 33l9 9 17-19" />
            </svg>
            <p class="arr-line a">{{ 'Your account is ready' | t }}</p>
            <p class="arr-line b">{{ 'Welcome, {name}' | t: { name: name() } }}</p>
            <p class="arr-note">
              {{ 'Your keys were made on this device and never left it.' | t }}
            </p>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .arr {
      position: fixed;
      inset: 0;
      z-index: 300;
      display: grid;
      place-items: center;
      overflow: hidden;
      color: #fff;
      background:
        radial-gradient(
          60rem circle at 50% 45%,
          color-mix(in oklab, var(--accent) 22%, transparent),
          transparent 70%
        ),
        var(--ink-950);
      transition:
        opacity 0.5s var(--ease-suave),
        transform 0.5s var(--ease-suave);
    }
    .arr-login,
    .arr-register {
      animation: wipe 0.55s var(--ease) both;
    }
    .arr.is-leaving {
      opacity: 0;
      transform: scale(1.04);
      pointer-events: none;
    }
    .arr-intro {
      cursor: pointer;
    }
    .arr-stage {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      text-align: center;
      padding: 1.5rem;
    }
    @keyframes wipe {
      from {
        clip-path: circle(0% at 50% 50%);
      }
      to {
        clip-path: circle(150% at 50% 50%);
      }
    }
    .arr-ring {
      position: absolute;
      top: 3.5rem;
      width: 7rem;
      height: 7rem;
      margin-top: -3.5rem;
      border-radius: 50%;
      border: 1.5px solid var(--accent);
      opacity: 0;
      animation: pulse 2.2s var(--ease-suave) 0.3s infinite;
    }
    .arr-ring.r2 {
      animation-delay: 0.9s;
    }
    .arr-ring.r3 {
      animation-delay: 1.5s;
    }
    @keyframes pulse {
      from {
        transform: scale(0.6);
        opacity: 0.7;
      }
      to {
        transform: scale(3.2);
        opacity: 0;
      }
    }
    .arr-mark {
      width: 7rem;
      height: 7rem;
      fill: none;
      stroke: var(--accent);
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 14px color-mix(in oklab, var(--accent) 60%, transparent));
    }
    .arr-mark .draw,
    .arr-lock .ring,
    .arr-lock .tick {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: draw 1s var(--ease) 0.2s forwards;
    }
    .arr-mark .lock-body,
    .arr-lock .lock-body {
      fill: var(--accent);
      stroke: none;
      opacity: 0;
      animation: fade 0.4s var(--ease-suave) 0.8s forwards;
    }
    .arr-mark .lock-shackle,
    .arr-lock .lock-shackle {
      opacity: 0;
      animation:
        fade 0.3s var(--ease-suave) 0.7s forwards,
        shut 0.5s var(--ease) 1s forwards;
      transform: translateY(-4px);
    }
    .arr-lock {
      width: 6rem;
      height: 6rem;
      fill: none;
      stroke: var(--accent);
      stroke-width: 2.6;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 16px color-mix(in oklab, var(--accent) 55%, transparent));
    }
    .arr-login .lock-shackle {
      transform: translateY(0);
      animation:
        fade 0.3s 0.1s forwards,
        open 0.5s var(--ease) 0.45s forwards;
    }
    .arr-login .lock-body {
      animation-delay: 0.1s;
    }
    .arr-login .ring {
      animation-duration: 0.8s;
      animation-delay: 0s;
    }
    .arr-register .ring {
      animation-duration: 0.7s;
      animation-delay: 0.45s;
    }
    .arr-register .tick {
      animation: draw 0.6s var(--ease) 1.1s forwards;
      stroke-width: 3.4;
    }
    @keyframes draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes fade {
      to {
        opacity: 1;
      }
    }
    @keyframes shut {
      to {
        transform: translateY(0);
      }
    }
    @keyframes open {
      to {
        transform: translate(5px, -6px) rotate(18deg);
      }
    }
    .arr-title {
      display: flex;
      margin: 0.8rem 0 0;
      font-size: clamp(1.8rem, 6vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .arr-title span {
      display: inline-block;
      opacity: 0;
      transform: translateY(0.6em);
      filter: blur(8px);
      animation: rise 0.7s var(--ease) calc(0.9s + var(--i) * 45ms) forwards;
    }
    @keyframes rise {
      to {
        opacity: 1;
        transform: none;
        filter: none;
      }
    }
    .arr-tag,
    .arr-line,
    .arr-note {
      margin: 0;
      opacity: 0;
      animation: fade 0.6s var(--ease-suave) forwards;
    }
    .arr-tag {
      color: var(--accent);
      font-size: 1rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      animation-delay: 1.9s;
    }
    .arr-skip {
      position: fixed;
      bottom: 1.4rem;
      font-size: 0.75rem;
      opacity: 0;
      color: var(--muted);
      animation: fade 0.6s 1.2s forwards;
    }
    .arr-line {
      font-size: 1.25rem;
      font-weight: 700;
    }
    .arr-line.a {
      animation-delay: 0.3s;
    }
    .arr-line.b {
      position: absolute;
      bottom: 0.6rem;
      animation-delay: 0.8s;
      color: var(--accent);
    }
    .arr-login .arr-line.a {
      animation:
        fade 0.3s 0.3s forwards,
        away 0.3s 0.75s forwards;
    }
    .arr-register .arr-line.a {
      animation-delay: 1.2s;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .arr-register .arr-line.b {
      position: static;
      animation-delay: 1.4s;
      font-size: 1.8rem;
    }
    .arr-register .arr-stage {
      gap: 0.4rem;
    }
    .arr-note {
      font-size: 0.8rem;
      color: var(--muted);
      animation-delay: 1.7s;
    }
    @keyframes away {
      to {
        opacity: 0;
      }
    }
    .arr-burst {
      position: absolute;
      top: 3rem;
      left: 50%;
    }
    .arr-burst i {
      position: absolute;
      width: 0.5rem;
      height: 0.8rem;
      border-radius: 2px;
      background: var(--c);
      opacity: 0;
      animation: burst 1.2s var(--ease) 0.9s forwards;
    }
    @keyframes burst {
      0% {
        opacity: 1;
        transform: rotate(var(--a)) translateY(0);
      }
      100% {
        opacity: 0;
        transform: rotate(var(--a)) translateY(calc(var(--d) * -1)) rotate(540deg);
      }
    }
  `,
})
export class ArrivalComponent implements OnInit, OnDestroy {
  private readonly arrival = inject(ArrivalService);
  readonly kind = input.required<ArrivalKind>();
  readonly name = input('');
  protected readonly leaving = signal(false);
  protected readonly letters = Array.from('Chatterly-Renewed');
  /** Pieces that fly out of the check mark when an account is created. */
  protected readonly confetti = Array.from({ length: 28 }, function piece(_, i) {
    const colors = ['#2ef2b0', '#a78bfa', '#fb7185', '#38bdf8', '#fbbf24'];
    return {
      angle: ((i * 360) / 28).toFixed(0) + 'deg',
      distance: 90 + ((i * 37) % 90) + 'px',
      color: colors[i % colors.length]!,
      delay: ((i % 5) * 0.03).toFixed(2) + 's',
    };
  });
  private timers: ReturnType<typeof setTimeout>[] = [];

  /** Schedules the reveal of the page underneath, the exit and the end. */
  ngOnInit(): void {
    const line = TIMELINE[this.kind()];
    this.timers.push(
      setTimeout(this.arrival.reveal.bind(this.arrival), line.reveal),
      setTimeout(this.startLeaving.bind(this), line.leave),
      setTimeout(this.arrival.finish.bind(this.arrival), line.end),
    );
  }

  /** The animation starts to fade away. */
  private startLeaving(): void {
    this.leaving.set(true);
  }

  /** A press on the introduction skips it. */
  protected skip(): void {
    if (this.kind() !== 'intro' || this.leaving()) {
      return;
    }
    this.leaving.set(true);
    this.clear();
    this.timers.push(setTimeout(this.arrival.finish.bind(this.arrival), 450));
  }

  /** Cancels the pending steps. */
  private clear(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];
  }

  /** Cancels the steps when the component goes away. */
  ngOnDestroy(): void {
    this.clear();
  }
}
