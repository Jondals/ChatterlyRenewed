/**
 * src/app/features/spinly/spinly-result.ts
 * The result Spinly (the separate prize wheel app) reports when a wheel stops or a tournament ends, and the
 * check that makes sure any such data is plain, short text before it is shown or stored in a message.
 */

/** A short result that can be posted to the chat (it travels inside the encrypted message). */
export interface SpinlyResult {
  kind: 'wheel' | 'tournament';
  /** Name of the tournament, if it has one. */
  title: string;
  /** Names of the options (wheel) or of the podium (tournament, best first). */
  names: string[];
  /** The winner of the wheel or the champion of the tournament. */
  winner: string;
}

/** Most names kept from one result. */
const MAX_NAMES = 25;

/** Collapses whitespace and trims a value to `max` characters; returns '' for anything that is not text. */
function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Validates a result that came from outside (another window or a message); returns null when it is not usable. */
export function sanitizeResult(raw: unknown): SpinlyResult | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const kind =
    record['kind'] === 'tournament' ? 'tournament' : record['kind'] === 'wheel' ? 'wheel' : null;
  const winner = cleanText(record['winner'], 40);
  if (!kind || !winner || !Array.isArray(record['names'])) {
    return null;
  }
  const names: string[] = [];
  for (const item of (record['names'] as unknown[]).slice(0, MAX_NAMES)) {
    const name = cleanText(item, 40);
    if (name) {
      names.push(name);
    }
  }
  return { kind, title: cleanText(record['title'], 40), names, winner };
}

/** A spin to replay: the options as they were, the final angle of the disc and the winner. */
export interface SpinlySpin {
  options: { name: string; color: string }[];
  rotation: number;
  winner: string;
}

/** Validates a spin that came from outside (Spinly itself or another person in the call); null when it is not usable. */
export function sanitizeSpin(raw: unknown): SpinlySpin | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const rotation = record['rotation'];
  if (
    !Array.isArray(record['options']) ||
    typeof rotation !== 'number' ||
    !Number.isFinite(rotation)
  ) {
    return null;
  }
  const options: { name: string; color: string }[] = [];
  for (const item of (record['options'] as unknown[]).slice(0, MAX_NAMES)) {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<
      string,
      unknown
    >;
    options.push({ name: cleanText(entry['name'], 20), color: cleanText(entry['color'], 16) });
  }
  const winner = cleanText(record['winner'], 20);
  return options.length > 0 && winner ? { options, rotation, winner } : null;
}
