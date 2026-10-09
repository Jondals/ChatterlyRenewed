/**
 * src/app/core/ringtones.ts
 * The call ringtones: four melodies written as notes (classic, Christmas, Halloween and New Year), the automatic
 * choice that follows the season, plus the storage of one custom sound on this device. The melodies are played by SoundService with WebAudio.
 */
import { packBlobs, runInStore, unpackBlobs, type StoreLocation } from './indexed-db';

/** The ringtone choices: the four melodies and the person's own file. */
export type RingtoneId = 'auto' | 'classic' | 'christmas' | 'halloween' | 'newyear' | 'custom';

/** How the notes of a melody sound. */
export type Timbre = 'soft' | 'bell' | 'spooky' | 'box';

/** A melody: notes as [MIDI number, beats] (a MIDI number of 0 is a rest). */
export interface Melody {
  label: string;
  /** Icon name and the color classes of its tile. */
  icon: string;
  tone: string;
  hint: string;
  bpm: number;
  timbre: Timbre;
  /** Seconds of silence before the melody repeats. */
  gap: number;
  /** A low line under the melody (same format as the notes). */
  bass?: [number, number][];
  /** Sleigh bells on every note. */
  bells?: boolean;
  notes: [number, number][];
}

/** The built-in melodies. Christmas and New Year use traditional tunes (public domain); the others are original. */
export const MELODIES: Record<Exclude<RingtoneId, 'custom' | 'auto'>, Melody> = {
  classic: {
    label: 'Classic',
    icon: 'phone',
    tone: 'bg-accent/15 text-accent',
    hint: 'A warm, bouncy loop in a major key.',
    bpm: 108,
    timbre: 'soft',
    gap: 0.6,
    bass: [
      [48, 2],
      [55, 2],
      [45, 2],
      [52, 2],
      [41, 2],
      [48, 2],
      [43, 2],
      [50, 2],
    ],
    notes: [
      [76, 1],
      [79, 0.5],
      [76, 0.5],
      [74, 1],
      [72, 1],
      [72, 1],
      [76, 1],
      [81, 1.5],
      [79, 0.5],
      [77, 1],
      [76, 0.5],
      [74, 0.5],
      [72, 1],
      [69, 1],
      [74, 1],
      [79, 1],
      [83, 1],
      [79, 1],
    ],
  },
  christmas: {
    label: 'Christmas',
    icon: 'star',
    tone: 'bg-emerald/15 text-emerald',
    hint: 'Deck the Halls, with sleigh bells.',
    bpm: 132,
    timbre: 'bell',
    gap: 0.8,
    bells: true,
    bass: [
      [48, 2],
      [55, 2],
      [41, 2],
      [48, 2],
      [48, 2],
      [55, 2],
      [43, 2],
      [41, 2],
    ],
    notes: [
      [72, 1.5],
      [71, 0.5],
      [69, 1],
      [67, 1],
      [65, 1],
      [67, 1],
      [69, 1],
      [65, 1],
      [67, 0.5],
      [69, 0.5],
      [71, 0.5],
      [67, 0.5],
      [69, 1.5],
      [67, 0.5],
      [65, 1],
      [64, 1],
      [65, 2],
    ],
  },
  halloween: {
    label: 'Halloween',
    icon: 'moon',
    tone: 'bg-amber/15 text-amber',
    hint: 'A spooky waltz in a minor key.',
    bpm: 138,
    timbre: 'spooky',
    gap: 0.9,
    bass: [
      [45, 3],
      [40, 3],
      [45, 3],
      [40, 1.5],
      [45, 1.5],
    ],
    notes: [
      [69, 1],
      [72, 1],
      [76, 1],
      [80, 1],
      [76, 1],
      [71, 1],
      [69, 1],
      [72, 1],
      [76, 1],
      [76, 1],
      [75, 1],
      [69, 1],
    ],
  },
  newyear: {
    label: 'New Year',
    icon: 'sparkles',
    tone: 'bg-violet/15 text-violet',
    hint: 'Ode to Joy, to celebrate.',
    bpm: 120,
    timbre: 'bell',
    gap: 0.8,
    bass: [
      [48, 4],
      [43, 4],
      [48, 4],
      [43, 4],
      [48, 4],
      [43, 4],
      [48, 4],
      [43, 2],
      [48, 2],
    ],
    notes: [
      [76, 1],
      [76, 1],
      [77, 1],
      [79, 1],
      [79, 1],
      [77, 1],
      [76, 1],
      [74, 1],
      [72, 1],
      [72, 1],
      [74, 1],
      [76, 1],
      [76, 1.5],
      [74, 0.5],
      [74, 2],
      [76, 1],
      [76, 1],
      [77, 1],
      [79, 1],
      [79, 1],
      [77, 1],
      [76, 1],
      [74, 1],
      [72, 1],
      [72, 1],
      [74, 1],
      [76, 1],
      [74, 1.5],
      [72, 0.5],
      [72, 2],
    ],
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

/** Frequency in hertz of a MIDI note number. */
export function midiToHertz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

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
