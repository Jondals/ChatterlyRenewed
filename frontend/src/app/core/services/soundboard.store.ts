/**
 * src/app/core/services/soundboard.store.ts
 * The person's own soundboard clips, kept in IndexedDB on this device only.
 */
import { Injectable, inject, signal } from '@angular/core';
import { pickFile } from '../file-picker';
import { packBlobs, runInStore, unpackBlobs, type StoreLocation } from '../indexed-db';
import { SoundService } from './sound.service';

/** A sound the person uploaded. */
export interface CustomSound {
  id: string;
  name: string;
  /** An emoji shown on the tile (none: a note). */
  emoji?: string;
  /** The sound as it plays (the part that was kept). */
  blob: Blob;
  /** The whole file, when the sound was cut: it lets the cut be changed later. */
  original?: Blob;
  /** The part kept, in seconds from the start of the original, and how long it lasts. */
  start?: number;
  end?: number;
  duration?: number;
  createdAt: number;
  /** The id of the category the person put it in (none: it is in "All" only). */
  category?: string;
}

const LOCATION: StoreLocation = {
  database: 'chatterly-renewed-sounds',
  store: 'clips',
  keyPath: 'id',
};
/** Reads every clip. */
function readAll(store: IDBObjectStore): IDBRequest {
  return store.getAll();
}

/** Stores a clip. */
function writeClip(clip: CustomSound, store: IDBObjectStore): IDBRequest {
  return store.put(clip);
}

/** Deletes a clip by id. */
function deleteClip(id: string, store: IDBObjectStore): IDBRequest {
  return store.delete(id);
}

/** Orders clips from the oldest to the newest. */
function byCreation(first: CustomSound, second: CustomSound): number {
  return first.createdAt - second.createdAt;
}

/** The person's own soundboard clips, stored only on this device (IndexedDB). */
@Injectable({ providedIn: 'root' })
export class SoundboardStore {
  private readonly sound = inject(SoundService);
  readonly clips = signal<CustomSound[]>([]);
  private loaded = false;

  /** Loads the clips from IndexedDB (only the first time it is called). */
  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    try {
      const clips = await runInStore<CustomSound[]>(LOCATION, 'readonly', readAll);
      this.clips.set(unpackBlobs(clips).sort(byCreation));
    } catch {
      this.clips.set([]);
    }
  }

  /** Keeps a sound that was prepared (checked and cut) in the window that edits sounds. */
  async save(clip: CustomSound): Promise<void> {
    await runInStore(LOCATION, 'readwrite', writeClip.bind(null, await packBlobs(clip)));
    this.clips.set([...this.clips(), clip]);
  }

  /** Puts a sound in a category (or takes it out of one). */
  async setCategory(id: string, category: string | undefined): Promise<void> {
    const clip = this.find(id);
    if (!clip) {
      return;
    }
    const next: CustomSound = { ...clip, category };
    await runInStore(LOCATION, 'readwrite', writeClip.bind(null, await packBlobs(next)));
    this.clips.set(
      this.clips().map(function replace(entry) {
        return entry.id === id ? next : entry;
      }),
    );
  }

  /** Deletes a clip. */
  async remove(id: string): Promise<void> {
    await runInStore(LOCATION, 'readwrite', deleteClip.bind(null, id));
    this.sound.forgetClip(id);
    const kept: CustomSound[] = [];
    for (const clip of this.clips()) {
      if (clip.id !== id) {
        kept.push(clip);
      }
    }
    this.clips.set(kept);
  }

  /** The clip of this store with that id, if any. */
  find(id: string): CustomSound | undefined {
    return this.clips().find(function same(clip: CustomSound) {
      return clip.id === id;
    });
  }

  /** Opens the file chooser for an audio file. */
  pickFile(): Promise<File | null> {
    return pickFile('audio/*,.mp3,.wav,.ogg,.m4a,.opus');
  }
}
