/**
 * src/app/shared/util/arrival-sounds.ts
 * The sounds of the animations of arriving. Each animation has its own soundtrack, a short audio file (see
 * public/sounds/auth): signing in is a padlock that opens, signing out is a padlock that shuts, the introduction closes the
 * padlock behind a swell, and creating an account ends in fireworks. Replace a file to change its soundtrack.
 *
 * ! Soft on purpose: the files are quiet (about -38 dB before the volume of the settings) and have no sharp highs. They only
 * play when the interface sounds are on and the browser already allows sound (before the first press of the person it does
 * not: then they are silent).
 */
import type { ArrivalKind } from '../../core/services/arrival.service';
import { playSound, soundReady, type SoundId } from '../../core/sound-library';

/** The file of each animation. */
const SOUNDTRACKS: Record<ArrivalKind, SoundId> = {
  intro: 'authIntro',
  login: 'authSignIn',
  logout: 'authSignOut',
  register: 'authSignUp',
};

/**
 * Starts the soundtrack of an animation of arriving.
 * @param context The audio context of the page.
 * @param output Where the sounds of the interface go (their master volume).
 * @param kind Which animation plays.
 * @returns A function that silences the sound (the animation was skipped or removed).
 */
export function playArrivalSounds(
  context: AudioContext,
  output: AudioNode,
  kind: ArrivalKind,
): () => void {
  const silent = function silent(): void {
    return;
  };
  if (context.state !== 'running' || !soundReady(SOUNDTRACKS[kind])) {
    return silent;
  }
  const source = playSound(context, output, SOUNDTRACKS[kind]);
  if (!source) {
    return silent;
  }
  return function silence(): void {
    try {
      source.stop(context.currentTime + 0.05);
    } catch {
      /* it had already ended */
    }
  };
}
