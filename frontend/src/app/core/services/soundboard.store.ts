/**
 * src/app/core/services/soundboard.store.ts
 * The person's own soundboard clips, kept in IndexedDB on this device only.
 */
import { Injectable, inject, signal } from '@angular/core';
import { pickFile } from '../file-picker';
import { runInStore, type StoreLocation } from '../indexed-db';
import { SoundService } from './sound.service';

/** A sound the person uploaded. */
export interface CustomSound {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number;
}

const LOCATION: StoreLocation = {
  database: 'chatterly-renewed-sounds',
  store: 'clips',
  keyPath: 'id',
};
/** Biggest sound file accepted (2 MB) and longest sound (20 seconds). */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SECONDS = 8;

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
      this.clips.set(clips.sort(byCreation));
    } catch {
      this.clips.set([]);
    }
  }

  /** Adds an audio file after checking that it decodes and is short enough; throws a readable message otherwise. */
  async add(file: File): Promise<void> {
    if (file.size > MAX_BYTES) {
      throw new Error('Sounds can be up to 2 MB.');
    }
    const buffer = await this.sound.context
      .decodeAudioData(await file.arrayBuffer())
      .catch(this.noBuffer);
    if (!buffer) {
      throw new Error('That file is not a playable audio file.');
    }
    if (buffer.duration > MAX_SECONDS) {
      throw new Error('Sounds can last up to 8 seconds.');
    }
    const clip: CustomSound = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Sound',
      blob: file,
      createdAt: Date.now(),
    };
    await runInStore(LOCATION, 'readwrite', writeClip.bind(null, clip));
    this.clips.set([...this.clips(), clip]);
  }

  /** Result used when a file cannot be decoded as audio. */
  private noBuffer(): null {
    return null;
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
