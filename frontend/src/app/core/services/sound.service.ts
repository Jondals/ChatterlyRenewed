/**
 * src/app/core/services/sound.service.ts
 * Interface sounds synthesized with WebAudio (clicks, notices, call tones and soundboard effects). Nothing is
 * downloaded: every sound is made from oscillators and filtered noise, so there is nothing to leak or tamper with.
 */
import { Injectable, effect, inject, untracked } from '@angular/core';
import {
  loadCustomClick,
  loadCustomRingtone,
  MELODIES,
  midiToHertz,
  resolveRingtone,
  type Melody,
  type RingtoneId,
  type Timbre,
} from '../ringtones';
import { SAMPLES, SAMPLE_LEVEL, playSample, preloadSamples, type SampleId } from '../sound-samples';
import { SettingsService } from './settings.service';

export type UiSound =
  | 'message'
  | 'send'
  | 'join'
  | 'leave'
  | 'mute'
  | 'unmute'
  | 'deafen'
  | 'undeafen'
  | 'click'
  | 'toggle'
  | 'connect'
  | 'success'
  | 'error'
  | 'open';
export type SfxId =
  | 'chime'
  | 'doorbell'
  | 'alarm'
  | 'horn'
  | 'boing'
  | 'trombone'
  | 'coin'
  | 'tada'
  | 'bubbles'
  | 'drumroll'
  | 'rimshot'
  | 'cymbal'
  | 'applause'
  | 'wave'
  | 'whoosh'
  | 'rain'
  | 'thunder'
  | 'sparkle'
  | 'spell';

/** The categories of the soundboard. */
export const SOUNDBOARD_GROUPS: { id: string; label: string; icon: string }[] = [
  { id: 'effects', label: 'Effects', icon: 'zap' },
  { id: 'ambient', label: 'Ambient', icon: 'leaf' },
];

/** The built-in soundboard effects. */
export const SOUNDBOARD: { id: SfxId; label: string; icon: string; group: string }[] = [
  { id: 'chime', label: 'Chime', icon: '🔔', group: 'effects' },
  { id: 'doorbell', label: 'Doorbell', icon: '🚪', group: 'effects' },
  { id: 'alarm', label: 'Siren', icon: '🚨', group: 'effects' },
  { id: 'horn', label: 'Air horn', icon: '📯', group: 'effects' },
  { id: 'boing', label: 'Boing', icon: '🏀', group: 'effects' },
  { id: 'trombone', label: 'Sad trombone', icon: '🎺', group: 'effects' },
  { id: 'coin', label: 'Coin', icon: '💰', group: 'effects' },
  { id: 'tada', label: 'Ta-da!', icon: '🎉', group: 'effects' },
  { id: 'drumroll', label: 'Drum roll', icon: '🥁', group: 'effects' },
  { id: 'rimshot', label: 'Rimshot', icon: '😏', group: 'effects' },
  { id: 'cymbal', label: 'Cymbal', icon: '💥', group: 'effects' },
  { id: 'applause', label: 'Applause', icon: '👏', group: 'effects' },
  { id: 'wave', label: 'Wave', icon: '🌊', group: 'ambient' },
  { id: 'whoosh', label: 'Wind', icon: '🌬️', group: 'ambient' },
  { id: 'rain', label: 'Rain', icon: '🌧️', group: 'ambient' },
  { id: 'thunder', label: 'Thunder', icon: '⛈️', group: 'ambient' },
  { id: 'sparkle', label: 'Sparkle', icon: '✨', group: 'ambient' },
  { id: 'spell', label: 'Spell', icon: '🔮', group: 'ambient' },
];

/** The recorded sound of each interface sound (the synthesized one plays until it is loaded), with its speed and level. */
const UI_SAMPLES: Partial<Record<UiSound, { id: SampleId; rate?: number; level?: number }>> = {
  message: { id: 'message', level: 1.1 },
  send: { id: 'send', level: 0.9 },
  join: { id: 'join', level: 0.9 },
  leave: { id: 'leave', level: 0.9 },
  mute: { id: 'mute', level: 0.8 },
  unmute: { id: 'unmute', level: 0.8 },
  deafen: { id: 'deafen', level: 0.9 },
  undeafen: { id: 'undeafen', level: 0.9 },
  toggle: { id: 'toggle', level: 0.9 },
  open: { id: 'open', level: 0.8 },
  success: { id: 'success', level: 1 },
  connect: { id: 'connect', level: 1 },
  error: { id: 'error', level: 1 },
};

/** The click styles that are recorded sounds. Their sound is also what a slider plays, higher or lower along its way. */
const CLICK_SAMPLES: Partial<Record<string, SampleId>> = {
  pop: 'pop',
  tap: 'tap',
  switch: 'switch',
  pluck: 'pluck',
  bubble: 'bubble',
};

/** General level of the synthesized sounds (so the quiet gains used below end up clearly audible). */
const MASTER_BOOST = 6;

/** Notes of the "connect" arpeggio and of the "sparkle" effect, in hertz. */
const CONNECT_NOTES = [523, 659, 784, 1046];
const SPARKLE_NOTES = [1175, 1480, 1760, 2349];

/** Whether a repeating melody has been stopped. */
interface MelodyState {
  stopped: boolean;
  /** Every note of the melody that was scheduled, so stopping it silences what is already queued. */
  nodes: AudioScheduledSourceNode[];
}

/** The custom ringtone that is looping (null source until it is decoded). */
interface CustomLoop {
  source: AudioBufferSourceNode | null;
  stopped: boolean;
}

/** All sounds are synthesized with WebAudio. */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly settings = inject(SettingsService);
  private audioContext: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly clips = new Map<string, AudioBuffer>();
  /** Level multiplier for the sound being scheduled (a press of a quiet or an important button). */
  private levelScale = 1;
  private lastSlide = 0;
  /** The click sound the person uploaded, decoded (null until it is loaded). */
  private clickClip: AudioBuffer | null = null;
  private clickLoading = false;
  private readonly clickWatcher = effect(this.watchClickClip.bind(this));
  /** While a melody is being scheduled, every sound source made is also put here. */
  private capture: AudioScheduledSourceNode[] | null = null;
  /** Timers of the melodies that are repeating, keyed by their stop state. */
  private readonly repeatTimers = new Map<MelodyState, ReturnType<typeof setTimeout>>();

  /** Keeps the master volume equal to the volume setting. */
  constructor() {
    effect(this.applyVolume.bind(this));
  }

  /** Master gain for the volume setting (0 to 100): a perceptual curve, then boosted. */
  private masterGain(): number {
    return Math.pow(this.settings.soundVolume() / 100, 1.5) * MASTER_BOOST;
  }

  /** Applies the volume setting to the master gain, once the audio context exists. */
  private applyVolume(): void {
    const gain = this.masterGain();
    if (this.master) {
      this.master.gain.value = gain;
    }
  }

  /** Shared audio context (also used by calls for spatial audio and level meters). */
  get context(): AudioContext {
    if (!this.audioContext) {
      const Context: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) {
        throw new Error('This browser has no Web Audio');
      }
      this.audioContext = new Context({ latencyHint: 'interactive' });
      this.master = this.audioContext.createGain();
      this.master.gain.value = this.masterGain();
      // A limiter after the boost keeps loud overlaps from distorting.
      const limiter = this.audioContext.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 10;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      this.master.connect(limiter).connect(this.audioContext.destination);
      // The recorded sounds (about 250 KB in all, once) start loading now that the person has interacted.
      preloadSamples(this.audioContext, Object.keys(SAMPLES) as SampleId[]);
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  /** The node every sound is connected to (the master volume). */
  get output(): AudioNode {
    void this.context;
    return this.master!;
  }

  /** True when the browser can make sounds with the page (a browser without Web Audio simply stays silent). */
  private get audible(): boolean {
    return (
      typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window)
    );
  }

  /** Plays an interface sound (nothing when sounds are off). */
  play(sound: UiSound, weight?: { pitch: number; level: number }): void {
    if (!this.settings.sounds() || !this.audible) {
      return;
    }
    if (sound === 'click') {
      this.levelScale = weight ? weight.level : 1;
      this.clickSound(weight ? weight.pitch : 1);
      this.levelScale = 1;
    } else if (!this.playRecorded(sound)) {
      this.synth(sound);
    }
  }

  /** Plays the recorded version of an interface sound; false when there is none or it is not loaded yet. */
  private playRecorded(sound: UiSound): boolean {
    const entry = UI_SAMPLES[sound];
    if (!entry) {
      return false;
    }
    return playSample(this.context, this.output, entry.id, {
      rate: entry.rate,
      gain: SAMPLE_LEVEL * (entry.level ?? 1) * this.levelScale,
    });
  }

  /** A soft tick for a step of a slider (`position` is 0 to 1): it rises in pitch as the slider goes up. */
  slide(position: number): void {
    if (!this.audible) {
      return;
    }
    const now = performance.now();
    if (
      !this.settings.sounds() ||
      this.settings.clickStyle() === 'off' ||
      now - this.lastSlide < 55
    ) {
      return;
    }
    this.lastSlide = now;
    this.slideTick(this.settings.clickStyle(), Math.max(0, Math.min(1, position)));
  }

  /**
   * The tick of one step of a slider, in the character of the chosen click sound: a recorded click is played faster
   * as the slider goes up, a synthesized style gets its own kind of tick (pitch, notes of a scale, a tap of noise...).
   */
  private slideTick(style: string, position: number): void {
    const sample = CLICK_SAMPLES[style];
    if (sample) {
      const rate = 0.8 + position * 0.8;
      if (playSample(this.context, this.output, sample, { rate, gain: SAMPLE_LEVEL * 0.7 })) {
        return;
      }
    }
    const scale = [0, 2, 4, 7, 9];
    const degree = Math.round(position * 9);
    const note = 523.25 * Math.pow(2, Math.floor(degree / 5) + scale[degree % 5]! / 12);
    switch (style) {
      case 'custom':
        this.playClickClip(0.75 + position * 0.75);
        break;
      case 'glass':
        this.tone(1100 + position * 1500, 0.1, 'sine', 0.05, 0);
        this.tone((1100 + position * 1500) * 1.5, 0.06, 'sine', 0.02, 0.004);
        break;
      case 'drop':
        this.tone(650 + position * 650, 0.07, 'sine', 0.07, 0, 330 + position * 200);
        break;
      case 'typewriter':
        this.noise(0.012, 0.08, 1600 + position * 2800, 0);
        this.tone(150 + position * 140, 0.03, 'sine', 0.05, 0, 100);
        break;
      case 'marimba':
        this.tone(note, 0.16, 'sine', 0.08, 0);
        this.tone(note * 2, 0.06, 'sine', 0.025, 0);
        break;
      case 'kalimba':
        this.tone(note * 2, 0.22, 'sine', 0.06, 0);
        this.tone(note * 4, 0.07, 'sine', 0.02, 0);
        break;
      default: {
        const hertz = 420 + position * 700;
        this.tone(hertz, 0.07, 'sine', 0.05, 0);
        this.tone(hertz * 2, 0.04, 'sine', 0.012, 0);
        break;
      }
    }
  }

  /** Plays a soundboard effect; it is always audible when asked for explicitly (by you or by someone in the call). */
  sfx(id: SfxId): void {
    if (!this.audible) {
      return;
    }
    this.levelScale = this.settings.callEffectsVolume() / 100;
    this.synth(id);
    this.levelScale = 1;
  }

  /** Plays an uploaded clip of the soundboard (always audible, like the built-in effects). */
  async playBlob(key: string, blob: Blob): Promise<void> {
    if (!this.audible) {
      return;
    }
    let buffer = this.clips.get(key);
    if (!buffer) {
      buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
      this.clips.set(key, buffer);
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const level = this.context.createGain();
    level.gain.value = this.settings.callEffectsVolume() / 100;
    source.connect(level).connect(this.output);
    source.start();
  }

  /** Forgets a decoded clip (when it is deleted). */
  forgetClip(key: string): void {
    this.clips.delete(key);
  }

  /** Starts the ringtone chosen in the settings for an incoming call; returns the function that stops it. */
  ring(): () => void {
    if (!this.settings.sounds() || !this.audible) {
      return this.noop;
    }
    return this.startRingtone(this.settings.ringtone());
  }

  /** Plays a ringtone so the person can hear it in the settings; returns the function that stops it. */
  preview(id: RingtoneId): () => void {
    if (!this.audible) {
      return this.noop;
    }
    return this.startRingtone(id);
  }

  /** Starts a ringtone on repeat: a melody is played again after its gap, the custom file is looped. */
  private startRingtone(id: RingtoneId): () => void {
    const real = resolveRingtone(id);
    if (real === 'custom') {
      return this.loopCustomRingtone();
    }
    const melody = MELODIES[real];
    const state: MelodyState = { stopped: false, nodes: [] };
    this.repeatMelody(melody, state);
    return this.stopMelody.bind(this, state);
  }

  /** Plays the melody and schedules the next repetition until it is stopped. */
  private repeatMelody(melody: Melody, state: MelodyState): void {
    if (state.stopped) {
      return;
    }
    this.capture = state.nodes;
    const length = this.playMelody(melody);
    this.capture = null;
    this.repeatTimers.set(
      state,
      setTimeout(this.repeatMelody.bind(this, melody, state), (length + melody.gap) * 1000),
    );
  }

  /** Stops a repeating melody. */
  private stopMelody(state: MelodyState): void {
    state.stopped = true;
    for (const node of state.nodes) {
      try {
        node.stop();
      } catch {
        // It had already ended.
      }
    }
    state.nodes = [];
    clearTimeout(this.repeatTimers.get(state));
    this.repeatTimers.delete(state);
  }

  /** Loops the custom ringtone file until the returned function is called. */
  private loopCustomRingtone(): () => void {
    const loop: CustomLoop = { source: null, stopped: false };
    void this.startCustom(loop);
    return this.stopCustom.bind(this, loop);
  }

  /** Decodes the stored file and starts looping it (unless it was stopped meanwhile). */
  private async startCustom(loop: CustomLoop): Promise<void> {
    const blob = await loadCustomRingtone();
    if (!blob || loop.stopped) {
      return;
    }
    try {
      const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
      if (loop.stopped) {
        return;
      }
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.output);
      source.start();
      loop.source = source;
    } catch {
      this.repeatMelody(MELODIES.classic, { stopped: false, nodes: [] });
    }
  }

  /** Stops the looping custom ringtone. */
  private stopCustom(loop: CustomLoop): void {
    loop.stopped = true;
    loop.source?.stop();
  }

  /** Plays a melody once and returns its length in seconds. */
  private playMelody(melody: Melody): number {
    const beat = 60 / melody.bpm;
    let at = 0;
    for (const [midi, beats] of melody.notes) {
      if (midi > 0) {
        this.note(midiToHertz(midi), beats * beat, melody.timbre, at);
        if (melody.bells) {
          this.noise(0.05, 0.035, 7200, at);
          this.noise(0.04, 0.025, 9000, at + 0.04);
        }
      }
      at += beats * beat;
    }
    let low = 0;
    for (const [midi, beats] of melody.bass ?? []) {
      if (midi > 0) {
        this.tone(midiToHertz(midi), beats * beat * 0.95, 'triangle', 0.075, low);
        this.tone(midiToHertz(midi) * 2, beats * beat * 0.4, 'sine', 0.02, low);
      }
      low += beats * beat;
    }
    return Math.max(at, low);
  }

  /** One melody note: every timbre gets a soft attack and a fading echo, so it sounds like a room and not like a beep. */
  private note(frequency: number, duration: number, timbre: Timbre, delay: number): void {
    const length = Math.max(duration * 1.1, 0.3);
    this.voice(frequency, length, timbre, delay, 1);
    this.voice(frequency, length * 0.8, timbre, delay + 0.22, 0.16);
    this.voice(frequency, length * 0.6, timbre, delay + 0.44, 0.06);
  }

  /** One sounding of a note with the character of its timbre, at a fraction of the full level. */
  private voice(
    frequency: number,
    length: number,
    timbre: Timbre,
    delay: number,
    level: number,
  ): void {
    if (timbre === 'bell') {
      this.tone(frequency, length * 1.4, 'sine', 0.08 * level, delay);
      this.tone(frequency * 2.76, length * 0.6, 'sine', 0.03 * level, delay);
      this.tone(frequency * 5.4, length * 0.25, 'sine', 0.01 * level, delay);
    } else if (timbre === 'spooky') {
      this.tone(frequency, length * 1.2, 'triangle', 0.07 * level, delay);
      this.tone(frequency * 1.007, length * 1.2, 'sine', 0.05 * level, delay, frequency * 0.99);
      this.tone(frequency * 3, length * 0.4, 'sine', 0.012 * level, delay);
    } else if (timbre === 'box') {
      this.tone(frequency, length * 0.9, 'triangle', 0.085 * level, delay);
      this.tone(frequency * 2, length * 0.45, 'sine', 0.04 * level, delay);
      this.tone(frequency * 4.01, length * 0.15, 'sine', 0.012 * level, delay);
    } else {
      this.tone(frequency, length * 1.1, 'sine', 0.1 * level, delay);
      this.tone(frequency * 2, length * 0.5, 'sine', 0.03 * level, delay);
    }
  }

  /** A function that does nothing. */
  private noop(): void {
    return;
  }

  /** The tiny sound under every button press; the pitch varies a little so it never feels repetitive. */
  private clickSound(pitch = 1): void {
    const style = this.settings.clickStyle();
    if (style === 'off') {
      return;
    }
    const jitter = (1 + (Math.random() - 0.5) * 0.08) * pitch;
    const sample = CLICK_SAMPLES[style];
    if (
      sample &&
      playSample(this.context, this.output, sample, {
        rate: jitter,
        gain: SAMPLE_LEVEL * this.levelScale,
      })
    ) {
      return;
    }
    switch (style) {
      case 'custom':
        this.playClickClip(jitter);
        break;
      case 'glass':
        this.tone(1760 * jitter, 0.18, 'sine', 0.07, 0);
        this.tone(2637 * jitter, 0.12, 'sine', 0.035, 0.005);
        break;
      case 'drop':
        this.tone(1000 * jitter, 0.12, 'sine', 0.09, 0, 420 * jitter);
        this.tone(2000 * jitter, 0.03, 'sine', 0.02, 0);
        break;
      case 'typewriter':
        this.noise(0.018, 0.1, 2200 * jitter, 0);
        this.tone(220 * jitter, 0.05, 'sine', 0.07, 0, 110);
        this.noise(0.01, 0.05, 4200, 0.04);
        break;
      case 'marimba':
        this.tone(523 * jitter, 0.22, 'sine', 0.1, 0);
        this.tone(1046 * jitter, 0.08, 'sine', 0.04, 0);
        this.noise(0.01, 0.03, 1500, 0);
        break;
      case 'kalimba':
        this.tone(1175 * jitter, 0.3, 'sine', 0.08, 0);
        this.tone(2350 * jitter, 0.1, 'sine', 0.03, 0);
        this.tone(1568 * jitter, 0.22, 'sine', 0.04, 0.045);
        break;
      default:
        this.tone(440 * jitter, 0.12, 'sine', 0.07, 0, 380 * jitter);
        this.tone(660 * jitter, 0.08, 'sine', 0.02, 0, 570 * jitter);
        break;
    }
  }

  /** Loads the uploaded click sound as soon as it is the one chosen. */
  private watchClickClip(): void {
    if (this.settings.clickStyle() === 'custom') {
      untracked(this.loadClickClip.bind(this));
    }
  }

  /** Reads and decodes the uploaded click sound (once). */
  private async loadClickClip(): Promise<void> {
    if (this.clickClip || this.clickLoading) {
      return;
    }
    this.clickLoading = true;
    try {
      const blob = await loadCustomClick();
      if (blob) {
        this.clickClip = await this.context.decodeAudioData(await blob.arrayBuffer());
      }
    } catch {
      this.clickClip = null;
    }
    this.clickLoading = false;
  }

  /** Forgets the decoded click sound (a new one was uploaded or it was deleted). */
  forgetClickClip(): void {
    this.clickClip = null;
    this.clickLoading = false;
    if (this.settings.clickStyle() === 'custom') {
      void this.loadClickClip();
    }
  }

  /** Plays the uploaded click sound, a little different every time. */
  private playClickClip(jitter: number): void {
    if (!this.clickClip) {
      void this.loadClickClip();
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = this.clickClip;
    source.playbackRate.value = jitter;
    const level = this.context.createGain();
    level.gain.value = this.levelScale;
    source.connect(level).connect(this.output);
    source.start();
  }

  /** Plays a series of notes one after another (`step` seconds apart). */
  private arpeggio(notes: number[], duration: number, gain: number, step: number): void {
    for (let index = 0; index < notes.length; index++) {
      this.tone(notes[index], duration, 'sine', gain, index * step);
    }
  }

  /** Plays one of the interface sounds or soundboard effects. */
  private synth(sound: UiSound | SfxId): void {
    switch (sound) {
      case 'message':
        this.tone(880, 0.09, 'sine', 0.06, 0);
        this.tone(1320, 0.14, 'sine', 0.05, 0.08);
        break;
      case 'send':
        this.tone(520, 0.08, 'triangle', 0.05, 0, 760);
        break;
      case 'join':
        this.tone(440, 0.1, 'sine', 0.06, 0);
        this.tone(660, 0.16, 'sine', 0.06, 0.1);
        break;
      case 'leave':
        this.tone(660, 0.1, 'sine', 0.06, 0);
        this.tone(440, 0.16, 'sine', 0.06, 0.1);
        break;
      case 'mute':
        this.tone(520, 0.08, 'sine', 0.06, 0, 470);
        this.tone(390, 0.12, 'sine', 0.05, 0.07, 340);
        break;
      case 'unmute':
        this.tone(390, 0.08, 'sine', 0.05, 0, 430);
        this.tone(588, 0.13, 'sine', 0.06, 0.07, 640);
        break;
      case 'deafen':
        this.tone(330, 0.12, 'sine', 0.06, 0, 270);
        this.tone(247, 0.2, 'sine', 0.055, 0.1, 190);
        this.tone(165, 0.22, 'triangle', 0.025, 0.1, 120);
        break;
      case 'undeafen':
        this.tone(247, 0.1, 'sine', 0.05, 0, 290);
        this.tone(370, 0.1, 'sine', 0.055, 0.09, 420);
        this.tone(554, 0.16, 'sine', 0.06, 0.18, 600);
        break;
      case 'toggle':
        this.tone(480, 0.06, 'sine', 0.07, 0, 720);
        break;
      case 'open':
        this.tone(380, 0.09, 'sine', 0.05, 0, 560);
        break;
      case 'success':
        this.tone(660, 0.09, 'sine', 0.06, 0);
        this.tone(990, 0.16, 'sine', 0.06, 0.08);
        break;
      case 'error':
        this.tone(220, 0.16, 'sawtooth', 0.04, 0, 160);
        break;
      case 'connect':
        this.arpeggio(CONNECT_NOTES, 0.14, 0.05, 0.07);
        break;
      case 'chime':
        this.tone(1046, 0.5, 'sine', 0.045, 0);
        this.tone(1318, 0.45, 'sine', 0.04, 0.12);
        this.tone(1568, 0.6, 'sine', 0.035, 0.24);
        break;
      case 'whoosh':
        this.noise(0.4, 0.035, 600, 0);
        this.noise(0.4, 0.045, 1800, 0.12);
        this.noise(0.35, 0.03, 3500, 0.26);
        break;
      case 'bubbles':
        for (let index = 0; index < 5; index++) {
          this.tone(
            300 + ((index * 137) % 400),
            0.09,
            'sine',
            0.045,
            index * 0.1,
            700 + ((index * 91) % 300),
          );
        }
        break;
      case 'sparkle':
        this.arpeggio(SPARKLE_NOTES, 0.14, 0.03, 0.07);
        break;
      case 'drumroll':
        for (let index = 0; index < 14; index++) {
          this.noise(0.04, 0.04 + index * 0.004, 900, index * 0.045);
        }
        this.tone(110, 0.3, 'sine', 0.1, 0.66, 60);
        break;
      case 'wave':
        this.tone(300, 0.55, 'sine', 0.045, 0, 600);
        this.tone(600, 0.55, 'sine', 0.035, 0.5, 300);
        break;
      case 'doorbell':
        this.tone(659, 0.6, 'sine', 0.08, 0);
        this.tone(523, 0.9, 'sine', 0.08, 0.4);
        break;
      case 'alarm':
        for (let index = 0; index < 4; index++) {
          this.tone(880, 0.1, 'square', 0.025, index * 0.22);
          this.tone(660, 0.1, 'square', 0.025, index * 0.22 + 0.11);
        }
        break;
      case 'horn':
        this.tone(233, 0.7, 'sawtooth', 0.04, 0, 225);
        this.tone(311, 0.7, 'sawtooth', 0.03, 0, 300);
        this.tone(349, 0.7, 'sawtooth', 0.025, 0, 340);
        break;
      case 'boing':
        this.tone(260, 0.22, 'sine', 0.1, 0, 620);
        this.tone(620, 0.35, 'sine', 0.09, 0.18, 230);
        break;
      case 'trombone':
        this.tone(233, 0.4, 'sawtooth', 0.035, 0);
        this.tone(220, 0.4, 'sawtooth', 0.035, 0.45);
        this.tone(208, 0.4, 'sawtooth', 0.035, 0.9);
        this.tone(196, 0.9, 'sawtooth', 0.035, 1.35, 150);
        break;
      case 'coin':
        this.tone(988, 0.08, 'square', 0.035, 0);
        this.tone(1319, 0.4, 'square', 0.035, 0.08);
        break;
      case 'tada':
        this.arpeggio([523, 659, 784], 0.12, 0.05, 0.1);
        this.tone(1046, 0.7, 'triangle', 0.06, 0.35);
        this.tone(784, 0.7, 'triangle', 0.05, 0.35);
        this.tone(659, 0.7, 'triangle', 0.04, 0.35);
        break;
      case 'cymbal':
        this.noise(1.1, 0.07, 6500, 0);
        this.noise(0.6, 0.05, 9500, 0);
        break;
      case 'applause':
        for (let index = 0; index < 46; index++) {
          this.noise(0.03, 0.035, 1500 + ((index * 263) % 2200), ((index * 37) % 160) / 100);
        }
        break;
      case 'rimshot':
        this.tone(200, 0.1, 'sine', 0.1, 0, 110);
        this.noise(0.05, 0.08, 2200, 0);
        this.tone(200, 0.1, 'sine', 0.1, 0.14, 110);
        this.noise(0.05, 0.08, 2200, 0.14);
        this.noise(0.7, 0.08, 7000, 0.34);
        this.tone(130, 0.15, 'sine', 0.1, 0.34, 70);
        break;
      case 'rain':
        for (let index = 0; index < 70; index++) {
          this.noise(0.025, 0.03, 3500 + ((index * 389) % 3500), ((index * 53) % 200) / 100);
        }
        break;
      case 'thunder':
        this.noise(1.8, 0.11, 260, 0);
        this.tone(60, 1.6, 'sine', 0.12, 0.05, 38);
        break;
      case 'spell':
        this.arpeggio([440, 554, 659, 880, 1108, 1397], 0.18, 0.04, 0.06);
        this.tone(1760, 0.5, 'sine', 0.04, 0.45, 2400);
        break;
      default:
        break;
    }
  }

  /**
   * Plays one note: an oscillator with a very short attack and an exponential decay.
   * @param frequency Pitch in hertz.
   * @param duration Length in seconds.
   * @param type Waveform.
   * @param gain Loudness (before the master volume).
   * @param delay Seconds to wait before it starts.
   * @param slideTo Optional pitch the note glides to by its end.
   */
  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay: number,
    slideTo?: number,
  ): void {
    const context = this.context;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const amplifier = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) {
      oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    }
    amplifier.gain.setValueAtTime(0.0001, start);
    amplifier.gain.exponentialRampToValueAtTime(gain * this.levelScale, start + 0.008);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(amplifier).connect(this.output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    this.capture?.push(oscillator);
  }

  /**
   * Plays a burst of filtered noise.
   * @param duration Length in seconds.
   * @param gain Loudness (before the master volume).
   * @param filterFrequency Center of the band that is let through, in hertz.
   * @param delay Seconds to wait before it starts.
   */
  private noise(duration: number, gain: number, filterFrequency: number, delay: number): void {
    const context = this.context;
    const start = context.currentTime + delay;
    const buffer = context.createBuffer(
      1,
      Math.max(1, Math.floor(context.sampleRate * duration)),
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFrequency;
    const amplifier = context.createGain();
    amplifier.gain.setValueAtTime(gain * this.levelScale, start);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(amplifier).connect(this.output);
    source.start(start);
    this.capture?.push(source);
  }
}
