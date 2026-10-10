/**
 * src/app/shared/util/arrival-sounds.ts
 * The sounds of the animations of arriving. Signing in is a padlock that OPENS, signing out is a padlock that SHUTS, and
 * behind each one a soft background: a breath of air that rises or falls and a slow pad of low notes. The introduction
 * and the sign-up reuse the same pieces (the lock shutting, a little shimmer, the pops of the fireworks).
 *
 * ! Soft on purpose: the padlock is made of the recorded sounds (see sound-samples.ts, all measured soft and leveled),
 * ! everything goes through one low-pass filter and a low level, and nothing is a loud boom or a high whistle. They are
 * scheduled all at once against the clock of the audio so they match the animation, go through the volume of the
 * interface, and only play when the interface sounds are on and the browser already allows sound (before the first press
 * of the person it does not: then they are silent).
 */
import type { ArrivalKind } from '../../core/services/arrival.service';
import { playSample, type SampleId } from '../../core/sound-samples';

/** Where a sound goes and what it uses. */
interface Rig {
  context: AudioContext;
  bus: AudioNode;
}

/** Level of the whole animation before the master volume of the interface. */
const BUS_LEVEL = 0.5;
/** Everything above this is cut: the harsh part of any sound. */
const BUS_LOWPASS_HERTZ = 5000;

/** One soft note: a sine that fades in and out slowly (a pad, not a beep), optionally sliding to another pitch. */
function note(
  rig: Rig,
  at: number,
  frequency: number,
  length: number,
  gain: number,
  slideTo?: number,
): void {
  const start = rig.context.currentTime + at;
  const oscillator = rig.context.createOscillator();
  const level = rig.context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + length);
  }
  level.gain.setValueAtTime(0.0001, start);
  level.gain.exponentialRampToValueAtTime(gain, start + length * 0.35);
  level.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(level).connect(rig.bus);
  oscillator.start(start);
  oscillator.stop(start + length + 0.03);
}

/** A breath of air: noise through a band filter that moves from one pitch to another, rising or falling in level. */
function air(
  rig: Rig,
  at: number,
  length: number,
  gain: number,
  from: number,
  to: number,
  rise: boolean,
): void {
  const { context } = rig;
  const start = context.currentTime + at;
  const buffer = context.createBuffer(
    1,
    Math.max(1, Math.floor(context.sampleRate * length)),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + length);
  const level = context.createGain();
  if (rise) {
    level.gain.setValueAtTime(0.0001, start);
    level.gain.exponentialRampToValueAtTime(gain, start + length * 0.9);
    level.gain.exponentialRampToValueAtTime(0.0001, start + length);
  } else {
    level.gain.setValueAtTime(gain, start);
    level.gain.exponentialRampToValueAtTime(0.0001, start + length);
  }
  source.connect(filter).connect(level).connect(rig.bus);
  source.start(start);
}

/** A slow pad: a few low notes that swell together and fade (the "effect" that sits behind the padlock). */
function pad(
  rig: Rig,
  at: number,
  length: number,
  frequencies: number[],
  gain: number,
  slide = 1,
): void {
  for (const frequency of frequencies) {
    note(rig, at, frequency, length, gain, frequency * slide);
  }
}

/** A recorded sound at a moment of the animation (nothing if it is not loaded: the rest carries the animation). */
function recorded(rig: Rig, id: SampleId, at: number, rate: number, level: number): void {
  playSample(rig.context, rig.bus, id, { at, rate, gain: level });
}

/** The padlock shutting: a small click, then the soft thump of the shackle going home. */
function lockShut(rig: Rig, at: number): void {
  recorded(rig, 'tap', at, 1.1, 0.9);
  recorded(rig, 'shut', at + 0.045, 0.85, 1);
  note(rig, at, 130, 0.22, 0.05, 80);
}

/** The padlock opening: a click, the thump of the shackle coming free, and a tiny glint. */
function lockOpen(rig: Rig, at: number): void {
  recorded(rig, 'tap', at, 1.3, 0.8);
  recorded(rig, 'unlock', at + 0.05, 1.5, 0.9);
  recorded(rig, 'glassa', at + 0.17, 1.5, 0.3);
}

/** A soft rising glimmer of glass notes (the app appears). */
function shimmer(rig: Rig, at: number): void {
  [1, 1.1892, 1.4983, 1.7818].forEach(function play(rate: number, index: number) {
    recorded(rig, index % 2 ? 'glassb' : 'glassa', at + index * 0.09, rate, 0.32);
  });
}

/** A low, round swell (the ring bursts, but gently). */
function swell(rig: Rig, at: number): void {
  note(rig, at, 98, 0.9, 0.1, 62);
}

/** The pop of a firework: a soft crack and a small glint. */
function pop(rig: Rig, at: number): void {
  recorded(rig, 'crack', at, 0.9 + Math.random() * 0.45, 0.7);
  recorded(rig, 'glassb', at + 0.05, 1.6 + Math.random() * 0.4, 0.18);
}

/**
 * Starts the sounds of an animation of arriving.
 * @param context The audio context of the page.
 * @param output Where the sounds of the interface go (their master volume).
 * @param kind Which animation plays.
 * @returns A function that silences the sounds (the animation was skipped or removed).
 */
export function playArrivalSounds(
  context: AudioContext,
  output: AudioNode,
  kind: ArrivalKind,
): () => void {
  if (context.state !== 'running') {
    return function silent(): void {
      return;
    };
  }
  const level = context.createGain();
  level.gain.value = BUS_LEVEL;
  const soften = context.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = BUS_LOWPASS_HERTZ;
  soften.Q.value = 0.5;
  level.connect(soften).connect(output);
  const rig: Rig = { context, bus: level };
  if (kind === 'intro') {
    air(rig, 0, 1.5, 0.05, 300, 1500, true);
    pad(rig, 0, 1.6, [110, 164.8, 220], 0.035, 1.12);
    lockShut(rig, 1.48);
    swell(rig, 1.55);
    shimmer(rig, 1.8);
  } else if (kind === 'login') {
    // The padlock opens: a breath of air rises, a pad of low notes swells, the lock comes free, a glint of glass.
    air(rig, 0.05, 0.9, 0.055, 300, 1800, true);
    pad(rig, 0.05, 1.5, [110, 146.8, 220], 0.035, 1.18);
    lockOpen(rig, 0.85);
    shimmer(rig, 1.05);
  } else if (kind === 'logout') {
    // The padlock shuts: the air and the pad fall, the lock shuts, and one low note says it is done.
    air(rig, 0, 0.7, 0.05, 1800, 300, false);
    pad(rig, 0, 1.2, [220, 164.8, 110], 0.035, 0.85);
    lockShut(rig, 0.7);
    note(rig, 0.95, 196, 0.6, 0.05, 130);
  } else {
    shimmer(rig, 1.1);
    swell(rig, 1.1);
    [1.5, 1.85, 2.25, 2.65, 2.9].forEach(function crack(at: number) {
      pop(rig, at);
    });
  }
  return function silence(): void {
    level.gain.setTargetAtTime(0, context.currentTime, 0.04);
  };
}
