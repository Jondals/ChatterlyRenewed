/**
 * src/app/core/ringtones.ts
 * The call ringtones: the four default ones (classic, Christmas, Halloween and New Year, audio files in
 * public/sounds/ringtones), the automatic choice that follows the season, and the storage of the person's own sounds (a
 * ringtone and a click) on this device.
 */
import { packBlobs, runInStore, unpackBlobs, type StoreLocation } from './indexed-db';

/** The ringtone choices: the four defaults and the person's own file. */
export type RingtoneId = 'auto' | 'classic' | 'christmas' | 'halloween' | 'newyear' | 'custom';

/** What the settings show of a default ringtone. The sound itself is its file (see sound-library.ts). */
export interface RingtoneInfo {
  label: string;
  /** Icon name and the color classes of its tile. */
  icon: string;
  tone: string;
  hint: string;
}

/** The default ringtones. Christmas and New Year use traditional tunes (public domain); the others are original. */
export const MELODIES: Record<Exclude<RingtoneId, 'custom' | 'auto'>, RingtoneInfo> = {
  classic: {
    label: 'Classic',
    icon: 'phone',
    tone: 'bg-accent/15 text-accent',
    hint: 'A warm, bouncy loop in a major key.',
  },
  christmas: {
    label: 'Christmas',
    icon: 'star',
    tone: 'bg-emerald/15 text-emerald',
    hint: 'Deck the Halls, with sleigh bells.',
  },
  halloween: {
    label: 'Halloween',
    icon: 'moon',
    tone: 'bg-amber/15 text-amber',
    hint: 'A spooky waltz in a minor key.',
  },
  newyear: {
    label: 'New Year',
    icon: 'sparkles',
    tone: 'bg-violet/15 text-violet',
    hint: 'Ode to Joy, to celebrate.',
  },
};

/** The ringtones in the order they are listed in the settings. */
export const RINGTONE_IDS: RingtoneId[] = [
  'auto',
  'classic',
  'christmas',
  'halloween',
  'newyear',
  'custom',
];

/** The melody that fits the time of the year: Halloween in October, Christmas in December, New Year until the 6th of January. */
export function seasonalRingtone(date: Date = new Date()): Exclude<RingtoneId, 'custom' | 'auto'> {
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 9 || (month === 10 && day <= 2)) {
    return 'halloween';
  }
  if (month === 11) {
    return day <= 25 ? 'christmas' : 'newyear';
  }
  if (month === 0 && day <= 6) {
    return 'newyear';
  }
  return 'classic';
}

/** The melody a ringtone really plays today (the automatic one follows the season). */
export function resolveRingtone(id: RingtoneId): Exclude<RingtoneId, 'auto'> {
  return id === 'auto' ? seasonalRingtone() : id;
}

const LOCATION: StoreLocation = { database: 'chatterly-renewed-ringtone', store: 'tone' };
const KEY = 'custom';

const CLICK_LOCATION: StoreLocation = { database: 'chatterly-renewed-click', store: 'tone' };

/** Stores the click sound the person uploaded on this device. */
export async function saveCustomClick(blob: Blob): Promise<unknown> {
  const packed = await packBlobs(blob);
  return runInStore(CLICK_LOCATION, 'readwrite', function put(store: IDBObjectStore) {
    return store.put(packed, KEY);
  });
}

/** Reads the uploaded click sound, or null when there is none. */
export async function loadCustomClick(): Promise<Blob | null> {
  try {
    const found = await runInStore<Blob | undefined>(
      CLICK_LOCATION,
      'readonly',
      function get(store: IDBObjectStore) {
        return store.get(KEY);
      },
    );
    return found ? unpackBlobs(found) : null;
  } catch {
    return null;
  }
}

/** Deletes the uploaded click sound. */
export function deleteCustomClick(): Promise<unknown> {
  return runInStore(CLICK_LOCATION, 'readwrite', function remove(store: IDBObjectStore) {
    return store.delete(KEY);
  });
}

/** Stores the custom ringtone file on this device. */
export async function saveCustomRingtone(blob: Blob): Promise<unknown> {
  const packed = await packBlobs(blob);
  return runInStore(LOCATION, 'readwrite', function put(store: IDBObjectStore) {
    return store.put(packed, KEY);
  });
}

/** Reads the custom ringtone file, or null when there is none. */
export async function loadCustomRingtone(): Promise<Blob | null> {
  try {
    const found = await runInStore<Blob | undefined>(
      LOCATION,
      'readonly',
      function get(store: IDBObjectStore) {
        return store.get(KEY);
      },
    );
    return found ? unpackBlobs(found) : null;
  } catch {
    return null;
  }
}

/** Deletes the custom ringtone file. */
export function deleteCustomRingtone(): Promise<unknown> {
  return runInStore(LOCATION, 'readwrite', function remove(store: IDBObjectStore) {
    return store.delete(KEY);
  });
}
