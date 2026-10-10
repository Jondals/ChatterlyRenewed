/**
 * src/app/core/sound-samples.ts
 * The small recorded sounds of the interface (Kenney "Interface Sounds", CC0, see public/sounds/LICENSE.txt): loading,
 * decoding once and playing them with a chosen pitch and level.
 *
 * Why: the sounds made only from oscillators are clean but thin. A few recorded clicks, plucks and chimes of 5 to 18 KB
 * each feel much more satisfying under a button. They are loaded only after the person first interacts (when the audio
 * context exists), one request per file and never again (cached), and the service falls back to the synthesized
 * sound for as long as a file is not loaded (or if it cannot be loaded), so a missing file never means silence.
 */

/** Every recorded sound: its id and the file in `public/sounds` (without the extension). */
export const SAMPLES = {
  tap: 'tap',
  pop: 'pop',
  switch: 'switch',
  pluck: 'pluck',
  bubble: 'bubble',
  crack: 'crack',
  toggle: 'toggle',
  send: 'send',
  message: 'message',
  success: 'success',
  connect: 'connect',
  join: 'join',
  leave: 'leave',
  mute: 'mute',
  unmute: 'unmute',
  deafen: 'deafen',
  undeafen: 'undeafen',
  open: 'open',
  unlock: 'unlock',
  shut: 'shut',
  error: 'error',
  glassa: 'glassa',
  glassb: 'glassb',
} as const;

export type SampleId = keyof typeof SAMPLES;

/** Level of a recorded sound before the master volume (they are recorded loud; the master volume boosts the quiet synths). */
export const SAMPLE_LEVEL = 0.14;

/** The decoded sounds. */
const buffers = new Map<SampleId, AudioBuffer>();
/** Loads that have started (also the failed ones: a file that cannot be loaded is not asked for again). */
const requested = new Map<SampleId, Promise<void>>();

/** Downloads and decodes one sound; a failure is ignored (the synthesized sound is used instead). */
async function fetchAndDecode(context: AudioContext, id: SampleId): Promise<void> {
  try {
    const response = await fetch(new URL('sounds/' + SAMPLES[id] + '.ogg', document.baseURI), {
      credentials: 'omit',
    });
    if (!response.ok) {
      return;
    }
    buffers.set(id, await context.decodeAudioData(await response.arrayBuffer()));
  } catch {
    /* no sound file: the synthesized one plays */
  }
}

/** Starts loading some sounds (each one only once). */
export function preloadSamples(context: AudioContext, ids: readonly SampleId[]): void {
  for (const id of ids) {
    if (!requested.has(id)) {
      requested.set(id, fetchAndDecode(context, id));
    }
  }
}

/** Whether a sound is decoded and ready to play right now. */
export function sampleReady(id: SampleId): boolean {
  return buffers.has(id);
}

/** What a sound plays with. */
export interface SampleOptions {
  /** Playback speed: 1 is the recording, above 1 is higher and shorter. */
  rate?: number;
  /** Level before the master volume. */
  gain?: number;
  /** Seconds from now. */
  at?: number;
}

/**
 * Plays a sound through a destination. Returns false when it is not loaded yet (and starts loading it), so the caller
 * can play the synthesized version instead.
 */
export function playSample(
  context: AudioContext,
  destination: AudioNode,
  id: SampleId,
  options: SampleOptions = {},
): boolean {
  const buffer = buffers.get(id);
  if (!buffer) {
    preloadSamples(context, [id]);
    return false;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = options.rate ?? 1;
  const level = context.createGain();
  level.gain.value = options.gain ?? SAMPLE_LEVEL;
  source.connect(level).connect(destination);
  source.start(context.currentTime + (options.at ?? 0));
  return true;
}
