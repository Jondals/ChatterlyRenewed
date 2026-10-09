/**
 * src/app/shared/util/audio-level.ts
 * The level of a sound as the meters show it.
 */

/** A level between 0 and 1 in decibels, as text (silence is minus infinity). */
export function decibels(level: number): string {
  return level < 0.002 ? '-∞' : (20 * Math.log10(level)).toFixed(0);
}
