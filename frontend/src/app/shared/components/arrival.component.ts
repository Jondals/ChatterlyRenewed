/**
 * src/app/shared/components/arrival.component.ts
 * The animations of arriving in the app, drawn over everything: the introduction of the first visit (an aurora and a
 * glowing floor, lights that spiral into the logo, a lock that snaps shut and a shockwave), the iris that opens the
 * app after signing in and the fireworks after creating an account. It is loaded only when one plays; the shapes are
 * CSS and SVG and the lights are drawn on a canvas by `arrival-fx.ts`, so nothing is downloaded but code.
 */
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { ArrivalService, type ArrivalKind } from '../../core/services/arrival.service';
import { startFx, type Fx } from '../util/arrival-fx';

/** For each kind: when the page underneath may change, when the animation starts to leave and when it is gone (ms). */
const TIMELINE: Record<ArrivalKind, { reveal: number; leave: number; end: number }> = {
  intro: { reveal: 0, leave: 3900, end: 4600 },
  login: { reveal: 1000, leave: 1700, end: 2300 },
  register: { reveal: 2200, leave: 3500, end: 4100 },
  logout: { reveal: 1100, leave: 1900, end: 2500 },
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
      <div class="arr-aurora"></div>
      <div class="arr-floor"></div>
      <canvas #fx class="arr-fx"></canvas>
      <span class="arr-flash"></span>
      <div class="arr-stage">
        <span class="arr-orbit"></span><span class="arr-orbit o2"></span>
        <span class="arr-wave"></span><span class="arr-wave w2"></span>
        @if (kind() === 'register') {
          <svg class="arr-logo" viewBox="0 0 64 64" aria-hidden="true">
            <circle class="ring" cx="32" cy="32" r="29" pathLength="1" />
            <path class="tick" pathLength="1" d="M19 33l9 9 17-19" />
          </svg>
        } @else {
          <svg class="arr-logo" viewBox="0 0 64 64" aria-hidden="true">
            <path
              class="draw"
              pathLength="1"
              d="M12 12h40a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H30l-10 9v-9h-8a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"
            />
            <path class="shackle" d="M28 24v-3a4 4 0 0 1 8 0v3" />
            <rect class="body" x="25" y="24" width="14" height="11" rx="3" />
            <path class="key" d="M32 28.4v3.4" />
          </svg>
        }
        <svg width="0" height="0" aria-hidden="true">
          <defs>
            <linearGradient id="arr-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#2ef2b0" />
              <stop offset="0.5" stop-color="#38bdf8" />
              <stop offset="1" stop-color="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
        @switch (kind()) {
          @case ('intro') {
            <h1 class="arr-title" aria-label="Chatterly-Renewed">
              @for (letter of letters; track $index) {
                <span [style.--i]="$index">{{ letter }}</span>
              }
            </h1>
            <p class="arr-tag">{{ 'Private by design' | t }}</p>
          }
          @case ('login') {
            <p class="arr-line a">{{ 'Unlocking your keys…' | t }}</p>
            <p class="arr-line b">{{ 'Welcome back, {name}' | t: { name: name() } }}</p>
          }
          @case ('logout') {
            <p class="arr-line a">{{ 'Locking your keys…' | t }}</p>
            <p class="arr-line b">{{ 'See you soon, {name}' | t: { name: name() } }}</p>
          }
          @case ('register') {
            <p class="arr-line a">{{ 'Your account is ready' | t }}</p>
            <p class="arr-line b">{{ 'Welcome, {name}' | t: { name: name() } }}</p>
            <p class="arr-note">
              {{ 'Your keys were made on this device and never left it.' | t }}
            </p>
          }
        }
      </div>
      @if (kind() === 'intro') {
        <span class="arr-skip">{{ 'Click to skip' | t }}</span>
      }
    </div>
  `,
  styles: `
    .arr {
      --g: linear-gradient(120deg, #2ef2b0, #38bdf8 50%, #a78bfa);
      position: fixed;
      inset: 0;
      z-index: 300;
      display: grid;
      place-items: center;
      overflow: hidden;
      color: #fff;
      background: #04070d;
      perspective: 900px;
      transition:
        opacity 0.7s var(--ease-suave),
        transform 0.7s var(--ease-suave),
        filter 0.7s var(--ease-suave);
    }
    .arr-login,
    .arr-logout,
    .arr-register {
      animation: iris 0.8s var(--ease) both;
    }
    @keyframes iris {
      from {
        clip-path: circle(0% at 50% 50%);
      }
      to {
        clip-path: circle(150% at 50% 50%);
      }
    }
    .arr.is-leaving {
      opacity: 0;
      transform: scale(1.35);
      filter: blur(12px) brightness(1.6);
      pointer-events: none;
    }
    .arr-intro {
      cursor: pointer;
    }
    .arr-aurora {
      position: absolute;
      inset: -30%;
      background:
        radial-gradient(40% 35% at 25% 30%, #2ef2b055, transparent 70%),
        radial-gradient(35% 40% at 78% 35%, #a78bfa55, transparent 70%),
        radial-gradient(45% 35% at 55% 80%, #38bdf844, transparent 70%);
      filter: blur(30px);
      animation:
        fade 1.2s forwards,
        drift 9s linear infinite;
      opacity: 0;
    }
    @keyframes drift {
      to {
        transform: rotate(360deg);
      }
    }
    .arr-floor {
      position: absolute;
      left: -50%;
      right: -50%;
      bottom: -10%;
      height: 55%;
      background:
        linear-gradient(#2ef2b033 1px, transparent 1px) 0 0 / 100% 48px,
        linear-gradient(90deg, #2ef2b033 1px, transparent 1px) 0 0 / 48px 100%;
      transform: rotateX(68deg);
      transform-origin: 50% 100%;
      mask-image: linear-gradient(to top, #000, transparent 85%);
      opacity: 0;
      animation:
        fade 1.2s 0.2s forwards,
        scroll 1.2s linear infinite;
    }
    .arr-login .arr-floor,
    .arr-logout .arr-floor,
    .arr-register .arr-floor {
      display: none;
    }
    @keyframes scroll {
      to {
        background-position:
          0 48px,
          48px 0;
      }
    }
    .arr-fx {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .arr-flash {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 45%, #fff, #2ef2b066 35%, transparent 65%);
      opacity: 0;
    }
    .arr-intro .arr-flash {
      animation: flash 0.9s ease-out 1.55s;
    }
    .arr-register .arr-flash {
      animation: flash 0.8s ease-out 1.1s;
    }
    @keyframes flash {
      0% {
        opacity: 0;
      }
      15% {
        opacity: 0.9;
      }
      100% {
        opacity: 0;
      }
    }
    .arr-stage {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      text-align: center;
      padding: 1.5rem;
      transform-style: preserve-3d;
    }
    .arr-wave {
      position: absolute;
      top: 6rem;
      width: 9rem;
      height: 9rem;
      margin: -4.5rem 0 0;
      border-radius: 50%;
      border: 2px solid #2ef2b0;
      box-shadow: 0 0 30px #2ef2b0;
      opacity: 0;
    }
    .arr-intro .arr-wave {
      animation: wave 1.3s ease-out 1.55s;
    }
    .arr-intro .arr-wave.w2 {
      animation-delay: 1.8s;
      border-color: #a78bfa;
      box-shadow: 0 0 30px #a78bfa;
    }
    .arr-login .arr-wave,
    .arr-logout .arr-wave {
      animation: wave 1s ease-out 0.8s;
    }
    .arr-register .arr-wave {
      animation: wave 1.2s ease-out 1.1s;
    }
    .arr-login .w2,
    .arr-logout .w2,
    .arr-register .w2 {
      display: none;
    }
    @keyframes wave {
      from {
        transform: scale(0.3);
        opacity: 1;
      }
      to {
        transform: scale(9);
        opacity: 0;
      }
    }
    .arr-logo {
      width: 9rem;
      height: 9rem;
      overflow: visible;
      fill: none;
      stroke: url(#arr-g);
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 18px #2ef2b099);
      opacity: 0;
      animation:
        spin-in 1.5s var(--ease) 0.15s forwards,
        glow 2.4s ease-in-out 1.6s infinite;
    }
    .arr-login .arr-logo,
    .arr-logout .arr-logo,
    .arr-register .arr-logo {
      animation:
        spin-in 0.9s var(--ease) 0.2s forwards,
        glow 2.4s ease-in-out 1.1s infinite;
    }
    @keyframes spin-in {
      from {
        opacity: 0;
        transform: rotateY(-200deg) scale(0.3);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @keyframes glow {
      50% {
        filter: drop-shadow(0 0 34px #a78bfacc);
      }
    }
    .draw,
    .ring,
    .tick {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: draw 1.2s var(--ease) 0.3s forwards;
    }
    .ring {
      animation-duration: 0.8s;
    }
    .tick {
      stroke-width: 3.6;
      animation: draw 0.7s var(--ease) 1s forwards;
    }
    @keyframes draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    .body {
      fill: url(#arr-g);
      stroke: none;
      opacity: 0;
      animation: fade 0.3s 1.1s forwards;
    }
    .shackle {
      opacity: 0;
      transform: translateY(-5px);
      animation:
        fade 0.2s 1.1s forwards,
        snap 0.35s cubic-bezier(0.6, 0, 0.3, 1.6) 1.45s forwards;
    }
    .arr-login .shackle {
      transform: none;
      animation:
        fade 0.2s 0.4s forwards,
        unlock 0.5s var(--ease) 0.7s forwards;
    }
    .arr-logout .shackle {
      transform: translate(5px, -7px) rotate(20deg);
      animation:
        fade 0.2s 0.4s forwards,
        snap 0.4s cubic-bezier(0.6, 0, 0.3, 1.6) 0.8s forwards;
    }
    .key {
      stroke: #04070d;
      stroke-width: 2.2;
      opacity: 0;
      animation: fade 0.3s 1.2s forwards;
    }
    .arr-login .key,
    .arr-logout .key {
      animation-delay: 0.5s;
    }
    .arr-orbit {
      position: absolute;
      top: 6rem;
      width: 13rem;
      height: 13rem;
      margin-top: -6.5rem;
      border-radius: 50%;
      border: 2px dashed #2ef2b066;
      border-top-color: #2ef2b0;
      opacity: 0;
      animation:
        fade 0.6s 0.3s forwards,
        drift 6s linear infinite;
    }
    .arr-orbit.o2 {
      width: 16rem;
      height: 16rem;
      margin-top: -8rem;
      border-color: #a78bfa44;
      border-bottom-color: #a78bfa;
      animation-direction: normal, reverse;
    }
    .arr-register .arr-orbit {
      display: none;
    }
    .arr-login .body,
    .arr-logout .body {
      animation-delay: 0.4s;
    }
    @keyframes snap {
      to {
        transform: none;
      }
    }
    @keyframes unlock {
      to {
        transform: translate(5px, -7px) rotate(20deg);
      }
    }
    @keyframes fade {
      to {
        opacity: 1;
      }
    }
    .arr-title {
      display: flex;
      margin: 1rem 0 0;
      font-size: clamp(2rem, 7vw, 3.6rem);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .arr-title span {
      display: inline-block;
      background: linear-gradient(100deg, #fff 35%, #2ef2b0 45%, #fff 55%) 150% 0 / 300% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      opacity: 0;
      transform: translateY(0.7em) rotateX(-80deg) scale(0.8);
      filter: blur(8px);
      animation:
        rise 0.8s var(--ease) calc(1.7s + var(--i) * 55ms) forwards,
        shine 1.1s ease-in-out 2.9s;
    }
    @keyframes rise {
      to {
        opacity: 1;
        transform: none;
        filter: none;
      }
    }
    @keyframes shine {
      to {
        background-position: -50% 0;
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
      background: var(--g);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      font-size: 1rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      animation-delay: 2.7s;
    }
    .arr-skip {
      position: absolute;
      bottom: 1.4rem;
      font-size: 0.75rem;
      color: #94a3b8;
      opacity: 0;
      animation: fade 0.6s 1.5s forwards;
    }
    .arr-line {
      font-size: 1.25rem;
      font-weight: 700;
      animation-delay: 0.5s;
    }
    .arr-login .arr-line.a,
    .arr-logout .arr-line.a {
      animation:
        fade 0.3s 0.4s forwards,
        gone 0.3s 0.95s forwards;
    }
    .arr-login .arr-line.b,
    .arr-logout .arr-line.b {
      position: absolute;
      bottom: 0.6rem;
      color: #2ef2b0;
      animation-delay: 1.1s;
    }
    .arr-register .arr-line.a {
      font-size: 0.95rem;
      color: #94a3b8;
      animation-delay: 1.5s;
    }
    .arr-register .arr-line.b {
      font-size: 2rem;
      background: var(--g);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation-delay: 1.7s;
    }
    .arr-note {
      font-size: 0.8rem;
      color: #94a3b8;
      animation-delay: 2.1s;
    }
    @keyframes gone {
      to {
        opacity: 0;
      }
    }
  `,
})
export class ArrivalComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly arrival = inject(ArrivalService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('fx');
  readonly kind = input.required<ArrivalKind>();
  readonly name = input('');
  protected readonly leaving = signal(false);
  protected readonly letters = Array.from('Chatterly-Renewed');
  private fx: Fx | null = null;
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

  /** Starts the lights once the canvas exists, and times the explosions to the shapes (the lock, the check). */
  ngAfterViewInit(): void {
    const kind = this.kind();
    this.fx = startFx(this.canvas().nativeElement, kind === 'logout' ? 'login' : kind);
    if (kind === 'intro') {
      this.at(1550, this.blast.bind(this, 0.5, 0.42, 40));
    } else if (kind === 'login' || kind === 'logout') {
      this.at(kind === 'login' ? 800 : 1000, this.blast.bind(this, 0.5, 0.45, 0));
    } else {
      this.at(1100, this.blast.bind(this, 0.5, 0.45, 70));
      this.at(1500, this.firework.bind(this, 0.25, 0.35));
      this.at(1850, this.firework.bind(this, 0.75, 0.3));
      this.at(2250, this.firework.bind(this, 0.5, 0.2));
      this.at(2650, this.firework.bind(this, 0.18, 0.55));
      this.at(2900, this.firework.bind(this, 0.82, 0.5));
    }
  }

  /** Runs a step after some time and remembers it so it can be cancelled. */
  private at(ms: number, step: () => void): void {
    this.timers.push(setTimeout(step, ms));
  }

  /** The ring of lights explodes, plus an extra burst of sparks from the logo. */
  private blast(x: number, y: number, extra: number): void {
    this.fx?.explode();
    if (extra) {
      this.fx?.burst(x, y, extra, this.kind() === 'register' ? 0.12 : 0);
    }
  }

  /** A firework: a round burst of sparks that then fall. */
  private firework(x: number, y: number): void {
    this.fx?.burst(x, y, 60, 0.07);
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
    this.timers.push(setTimeout(this.arrival.finish.bind(this.arrival), 650));
  }

  /** Cancels the pending steps. */
  private clear(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers = [];
  }

  /** Cancels the steps and stops the lights when the component goes away. */
  ngOnDestroy(): void {
    this.clear();
    this.fx?.stop();
  }
}
