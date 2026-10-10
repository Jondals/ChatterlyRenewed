/**
 * src/app/core/audio-chain.ts
 * The processing of the voice between the microphone and what is sent to the call (or to the test of the microphone):
 * volume of the input, a filter for low rumble, a clearer voice, and a leveler that evens out loud and quiet words.
 * The browser already offers noise suppression, echo cancellation and automatic gain (see the audio settings); this is
 * what comes after them, built with Web Audio nodes that run inside the audio thread (no cost for the page).
 */

/** How strongly the unwanted sound around the voice is removed. */
export type VoiceCleanup = 'off' | 'light' | 'strong';
/** How much the loud and quiet parts of the voice are brought closer. */
export type VoiceLeveler = 'off' | 'gentle' | 'strong';

/** What the person chose for the voice. */
export interface VoiceOptions {
  /** Volume of the microphone in percent (100 is as it comes). */
  inputVolume: number;
  cleanup: VoiceCleanup;
  leveler: VoiceLeveler;
  /** A little more presence in the voice and less boominess. */
  clarity: boolean;
}

/** The connected nodes: audio enters `input` and leaves through `output`. */
export interface VoiceChain {
  input: AudioNode;
  output: AudioNode;
}

/** Cut-off of the filter for low rumble (hum, desks, wind) for each level of cleanup. */
const RUMBLE_CUTOFF: Record<VoiceCleanup, number> = { off: 0, light: 90, strong: 140 };

/** Compressor settings for each level of the leveler: threshold in dB, ratio and the speed of attack and release. */
const LEVELER: Record<Exclude<VoiceLeveler, 'off'>, [number, number, number, number]> = {
  gentle: [-26, 2.5, 0.01, 0.25],
  strong: [-34, 5, 0.005, 0.2],
};

/**
 * Builds the chain of the voice. Nodes that are switched off are not created, so a plain setup is just a wire.
 * @param context The audio context where it runs.
 * @param options What the person chose.
 */
export function buildVoiceChain(context: BaseAudioContext, options: VoiceOptions): VoiceChain {
  const volume = context.createGain();
  volume.gain.value = Math.max(0, Math.min(2, options.inputVolume / 100));
  let tail: AudioNode = volume;
  const append = function append(node: AudioNode): void {
    tail.connect(node);
    tail = node;
  };
  const cutoff = RUMBLE_CUTOFF[options.cleanup];
  if (cutoff > 0) {
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = cutoff;
    highpass.Q.value = 0.7;
    append(highpass);
  }
  if (options.cleanup === 'strong') {
    // Hiss lives above the voice: a gentle fall from 9 kHz takes it away without making the voice dull.
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 9000;
    lowpass.Q.value = 0.5;
    append(lowpass);
  }
  if (options.clarity) {
    const body = context.createBiquadFilter();
    body.type = 'lowshelf';
    body.frequency.value = 220;
    body.gain.value = -2.5;
    append(body);
    const presence = context.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3200;
    presence.Q.value = 0.9;
    presence.gain.value = 3;
    append(presence);
  }
  if (options.leveler !== 'off') {
    const [threshold, ratio, attack, release] = LEVELER[options.leveler];
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = threshold;
    compressor.knee.value = 12;
    compressor.ratio.value = ratio;
    compressor.attack.value = attack;
    compressor.release.value = release;
    append(compressor);
    // The compressor lowers the loud parts: this brings the whole voice back up to where it was.
    const makeup = context.createGain();
    makeup.gain.value = options.leveler === 'strong' ? 1.8 : 1.35;
    append(makeup);
  }
  return { input: volume, output: tail };
}
