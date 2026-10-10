/**
 * src/app/core/sound-samples.ts
 * The small recorded sounds of the interface (Kenney "Interface Sounds", CC0, see public/sounds/LICENSE.txt): loading,
 * decoding once and playing them with a chosen pitch and level.
 *
 * Why: the sounds made only from oscillators are clean but thin. A few recorded clicks, bloops and soft chimes of 5 to
 * 18 KB each feel much more satisfying under a button. They are loaded only after the person first interacts (when the
 * audio context exists), one request per file and never again (cached), and the service falls back to the synthesized
 * sound for as long as a file is not loaded (or if it cannot be loaded), so a missing file never means silence.
 *
 * ! Soft on purpose: every sound was MEASURED (spectral centroid, level) and only the soft ones were kept (nothing
 * ! brighter than about 2.5 kHz for the sounds that repeat), each one has a gain that brings it to the same loudness
 * ! (`trim`), and everything goes through a low-pass filter, so no sound is harsh or louder than the others.
 */

/** One recorded sound: its file in `public/sounds` (without the extension) and the gain that levels it with the others. */
interface Sample {
  file: string;
  trim: number;
}

/** Every recorded sound by the name it is used with. The trims come from the measured level of each file. */
export const SAMPLES = {
  tap: { file: 'back_004', trim: 0.27 },
  pop: { file: 'back_002', trim: 0.24 },
  switch: { file: 'tick_004', trim: 0.24 },
  pluck: { file: 'glass_006', trim: 0.34 },
  bubble: { file: 'drop_003', trim: 0.38 },
  crack: { file: 'drop_001', trim: 0.39 },
  toggle: { file: 'tick_004', trim: 0.24 },
  send: { file: 'drop_003', trim: 0.38 },
  message: { file: 'confirmation_002', trim: 0.22 },
  success: { file: 'confirmation_001', trim: 0.15 },
  connect: { file: 'maximize_006', trim: 0.21 },
  exit: { file: 'minimize_006', trim: 0.21 },
  join: { file: 'maximize_008', trim: 0.17 },
  leave: { file: 'minimize_008', trim: 0.17 },
  mute: { file: 'minimize_009', trim: 0.14 },
  unmute: { file: 'maximize_009', trim: 0.14 },
  deafen: { file: 'drop_004', trim: 0.39 },
  undeafen: { file: 'drop_004', trim: 0.39 },
  open: { file: 'back_002', trim: 0.24 },
  unlock: { file: 'drop_004', trim: 0.39 },
  shut: { file: 'drop_002', trim: 0.39 },
  error: { file: 'error_005', trim: 0.34 },
  glassa: { file: 'glass_001', trim: 0.39 },
  glassb: { file: 'glass_002', trim: 0.35 },
} as const satisfies Record<string, Sample>;

export type SampleId = keyof typeof SAMPLES;

/** Level of a recorded sound before the master volume (the trims already match their loudness). */
export const SAMPLE_LEVEL = 1;

/** Where the sounds are cut off: what is above is the harsh part, and the sounds sit better in the mix without it. */
const LOWPASS_HERTZ = 6500;

/** The decoded sounds by file. */
const buffers = new Map<string, AudioBuffer>();
/** Loads that have started by file (also the failed ones: a file that cannot be loaded is not asked for again). */
const requested = new Map<string, Promise<void>>();

/** Downloads and decodes one file; a failure is ignored (the synthesized sound is used instead). */
async function fetchAndDecode(context: AudioContext, file: string): Promise<void> {
  try {
    const response = await fetch(new URL('sounds/' + file + '.ogg', document.baseURI), {
      credentials: 'omit',
    });
    if (!response.ok) {
      return;
    }
    buffers.set(file, await context.decodeAudioData(await response.arrayBuffer()));
  } catch {
    /* no sound file: the synthesized one plays */
  }
}

/** Starts loading some sounds (each file only once, even if several names use it). */
export function preloadSamples(context: AudioContext, ids: readonly SampleId[]): void {
  for (const id of ids) {
    const file = SAMPLES[id].file;
    if (!requested.has(file)) {
      requested.set(file, fetchAndDecode(context, file));
    }
  }
}

/** Whether a sound is decoded and ready to play right now. */
export function sampleReady(id: SampleId): boolean {
  return buffers.has(SAMPLES[id].file);
}

/** What a sound plays with. */
export interface SampleOptions {
  /** Playback speed: 1 is the recording, above 1 is higher and shorter. */
  rate?: number;
  /** Level before the master volume (1 is the matched loudness of the sounds). */
  gain?: number;
  /** Seconds from now. */
  at?: number;
}

/**
 * Plays a sound through a destination, leveled and softened. Returns false when it is not loaded yet (and starts loading
 * it), so the caller can play the synthesized version instead.
 */
export function playSample(
  context: AudioContext,
  destination: AudioNode,
  id: SampleId,
  options: SampleOptions = {},
): boolean {
  const sample = SAMPLES[id];
  const buffer = buffers.get(sample.file);
  if (!buffer) {
    preloadSamples(context, [id]);
    return false;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = options.rate ?? 1;
  const soften = context.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = LOWPASS_HERTZ;
  soften.Q.value = 0.5;
  const level = context.createGain();
  level.gain.value = (options.gain ?? SAMPLE_LEVEL) * sample.trim;
  source.connect(soften).connect(level).connect(destination);
  source.start(context.currentTime + (options.at ?? 0));
  return true;
}
