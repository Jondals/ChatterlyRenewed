/**
 * src/app/shared/util/arrival-sounds.ts
 * The sounds of the animations of arriving: a rising sweep while the lights gather, the click of the padlock when it
 * shuts or opens, a deep boom with the flash, a shimmer of notes when the app appears and the pops of the fireworks.
 * They are made with Web Audio (no files), scheduled all at once against the clock of the audio so they match the
 * animation, and go through the volume of the interface. They only play when the interface sounds are on and the
 * browser already allows sound (before the first press of the person it does not: then they are silent).
 */
import type { ArrivalKind } from '../../core/services/arrival.service';

/** Where a sound goes and what it uses. */
interface Rig {
  context: AudioContext;
  bus: GainNode;
}

/** One note: a short oscillator that fades out, optionally sliding to another pitch. */
function note(
  rig: Rig,
  at: number,
  frequency: number,
  length: number,
  type: OscillatorType,
  gain: number,
  slideTo?: number,
): void {
  const start = rig.context.currentTime + at;
  const oscillator = rig.context.createOscillator();
  const level = rig.context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + length);
  }
  level.gain.setValueAtTime(0.0001, start);
  level.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  level.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(level).connect(rig.bus);
  oscillator.start(start);
  oscillator.stop(start + length + 0.03);
}

/** A burst of noise through a band filter that can sweep from one pitch to another. */
function hiss(
  rig: Rig,
  at: number,
  length: number,
  gain: number,
  from: number,
  to: number,
  rise = false,
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
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + length);
  const level = context.createGain();
  level.gain.setValueAtTime(rise ? 0.0001 : gain, start);
  if (rise) {
    level.gain.exponentialRampToValueAtTime(gain, start + length * 0.85);
    level.gain.exponentialRampToValueAtTime(0.0001, start + length);
  } else {
    level.gain.exponentialRampToValueAtTime(0.0001, start + length);
  }
  source.connect(filter).connect(level).connect(rig.bus);
  source.start(start);
}

/** The padlock shutting: a sharp click, a second softer one, and a low knock. */
function lockShut(rig: Rig, at: number): void {
  hiss(rig, at, 0.05, 0.9, 3200, 2600);
  hiss(rig, at + 0.075, 0.07, 0.6, 1700, 1200);
  note(rig, at, 150, 0.12, 'sine', 0.35, 70);
}

/** The padlock opening: a click, then the little spring of the shackle. */
function lockOpen(rig: Rig, at: number): void {
  hiss(rig, at, 0.05, 0.8, 2400, 2000);
  note(rig, at + 0.06, 520, 0.16, 'triangle', 0.14, 980);
  hiss(rig, at + 0.1, 0.1, 0.25, 4200, 6200);
}

/** A bright chord arpeggiated upwards (the app appears). */
function shimmer(rig: Rig, at: number): void {
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function play(frequency: number, index: number) {
    note(rig, at + index * 0.07, frequency, 0.7, 'sine', 0.13);
    note(rig, at + index * 0.07, frequency * 2, 0.5, 'sine', 0.04);
  });
}

/** A deep boom (the ring bursts). */
function boom(rig: Rig, at: number): void {
  note(rig, at, 110, 0.7, 'sine', 0.55, 38);
  hiss(rig, at, 0.5, 0.5, 500, 90);
}

/** The pop of a firework: a crack and a falling sparkle. */
function pop(rig: Rig, at: number): void {
  hiss(rig, at, 0.09, 0.7, 1800, 900);
  note(rig, at + 0.03, 1900, 0.35, 'sine', 0.07, 700);
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
  const bus = context.createGain();
  bus.gain.value = 0.6;
  bus.connect(output);
  const rig: Rig = { context, bus };
  if (kind === 'intro') {
    hiss(rig, 0, 1.5, 0.35, 250, 2600, true);
    lockShut(rig, 1.48);
    boom(rig, 1.55);
    shimmer(rig, 1.75);
  } else if (kind === 'login') {
    hiss(rig, 0.1, 0.8, 0.25, 300, 2200, true);
    lockOpen(rig, 0.9);
    shimmer(rig, 1.0);
  } else if (kind === 'logout') {
    hiss(rig, 0.05, 0.6, 0.2, 2000, 300);
    lockShut(rig, 0.78);
    note(rig, 1.05, 392, 0.5, 'sine', 0.12, 261.6);
  } else {
    shimmer(rig, 1.1);
    boom(rig, 1.1);
    [1.5, 1.85, 2.25, 2.65, 2.9].forEach(function crack(at: number) {
      pop(rig, at);
    });
  }
  return function silence(): void {
    bus.gain.setTargetAtTime(0, context.currentTime, 0.04);
  };
}
