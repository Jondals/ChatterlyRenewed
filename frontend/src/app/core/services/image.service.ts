/**
 * src/app/core/services/image.service.ts
 * Picking, cropping, re-encoding and uploading of profile pictures, banners and group icons, and loading
 * them back as blob URLs.
 */
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { fromB64, randomBytes } from '../crypto/bytes';
import { derivePairKey, openBytes, sealBytes } from '../crypto/pairwise';
import { pickFile as pickSingleFile } from '../file-picker';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export type ImageKind = 'avatar' | 'banner' | 'group';

/** Final size of each kind of picture, in pixels. */
export const IMAGE_PRESETS: Record<ImageKind, { width: number; height: number }> = {
  avatar: { width: 256, height: 256 },
  group: { width: 256, height: 256 },
  banner: { width: 1200, height: 400 },
};

/** How often the keys of the own pictures are offered to the people who arrived since (while the page is open). */
const SHARE_EVERY_MS = 5 * 60 * 1000;
/** A picture that was offered less than this long ago is not offered again (the page may have been reloaded). */
const SHARE_AGAIN_AFTER_MS = 4 * 60 * 1000;

/** Size of a wallpaper that stays on this device. */
const WALLPAPER_SIZE = { width: 1920, height: 1080 };

/**
 * Profile pictures, banners and group icons. Pictures are center-cropped and re-encoded to WebP in the
 * browser before upload (which also strips EXIF/location metadata), then fetched back through the
 * authenticated API as blob URLs so the strict CSP never has to allow remote images.
 *
 * * Profile pictures and banners are END-TO-END ENCRYPTED. Each picture gets a random AES-256-GCM key; the server stores
 * only the ciphertext; the key is sealed for each person who may see it with the pair key between the owner and that
 * person (the same ECDH identity the direct messages use). Only the owner's browser seals keys, so a new friend sees the
 * picture the next time the owner is online (see `shareMine`). Group icons are not encrypted (members read them).
 */
@Injectable({ providedIn: 'root' })
export class ImageService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly urls = signal<Record<string, string>>({});
  private readonly inflight = new Set<string>();
  /** The key of each encrypted picture this browser already has (by picture id). */
  private readonly pictureKeys = new Map<string, CryptoKey>();
  /** The encrypted pictures that are being opened or were opened, by id (one request each). */
  private readonly opened = new Map<string, Promise<Blob>>();
  /** The own pictures that were already offered to the people around in this session. */
  private readonly offered = new Set<string>();
  /** Pictures whose key is not for this person yet: asked again later, a few times. */
  private readonly retries = new Map<string, number>();

  constructor() {
    effect(this.shareOwnPictures.bind(this, false));
    setInterval(this.shareOwnPictures.bind(this, true), SHARE_EVERY_MS);
  }

  /** Seals the keys of the person's own picture and banner for whoever can see them and does not have them yet. */
  private shareOwnPictures(everyone: boolean): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }
    const user = this.auth.user();
    for (const id of [user?.avatarImage, user?.bannerImage]) {
      // A change of the profile (a status, a name) runs this too: a picture is offered once, then on the timer only.
      if (!id || (!everyone && this.offered.has(id))) {
        continue;
      }
      this.offered.add(id);
      untracked(this.shareOwn.bind(this, id));
    }
  }

  /** Reactive: the blob URL of an image once it has loaded (null before). Call `ensure` to start loading. */
  url(id: string | null | undefined): string | null {
    return id ? (this.urls()[id] ?? null) : null;
  }

  /**
   * Starts downloading a picture if it is not loaded or loading yet. `sealed` says it is a profile picture or a banner
   * (encrypted); group icons are plain.
   */
  ensure(id: string | null | undefined, sealed = true): void {
    if (!id || this.urls()[id] || this.inflight.has(id)) {
      return;
    }
    this.inflight.add(id);
    this.fetchPicture(id, sealed)
      .then(this.storeImage.bind(this, id), this.retryLater.bind(this, id, sealed))
      .finally(this.inflight.delete.bind(this.inflight, id));
  }

  /** Downloads a picture and opens it when it is encrypted. */
  private fetchPicture(id: string, sealed: boolean): Promise<Blob> {
    if (!sealed) {
      return this.api.download('/api/images/' + id).then(function plain(bytes) {
        return new Blob([bytes]);
      });
    }
    return this.loadSealed(id);
  }

  /**
   * Opens an encrypted picture: one request brings the ciphertext and the key sealed for this person; the key is opened
   * with the pair key between the owner and this person, and the picture is decrypted. The key is kept (the owner needs it
   * to seal it for others).
   */
  private loadSealed(id: string): Promise<Blob> {
    let promise = this.opened.get(id);
    if (!promise) {
      promise = this.openSealed(id);
      this.opened.set(id, promise);
      promise.catch(this.opened.delete.bind(this.opened, id));
    }
    return promise;
  }

  /** The work of `loadSealed`. */
  private async openSealed(id: string): Promise<Blob> {
    const answer = await this.api.get<{
      iv: string;
      ciphertext: string;
      ownerEcdh: string;
      data: string;
    }>('/api/images/' + id + '/open');
    let key = this.pictureKeys.get(id);
    if (!key) {
      const identity = this.auth.identity;
      const pair = await derivePairKey(
        identity.ecdhPrivate,
        identity.publicKeys.ecdh,
        answer.ownerEcdh,
        'profile-picture|' + id,
      );
      const raw = await openBytes(
        pair,
        { iv: answer.iv, ciphertext: answer.ciphertext },
        'profile-picture|' + id + '|' + this.auth.userId,
      );
      key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
      this.pictureKeys.set(id, key);
    }
    const bytes = fromB64(answer.data);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12), tagLength: 128 },
      key,
      bytes.slice(12),
    );
    return new Blob([plain], { type: 'image/webp' });
  }

  /** Keeps a downloaded picture as a blob URL. */
  private storeImage(id: string, blob: Blob): void {
    this.retries.delete(id);
    this.urls.set({ ...this.urls(), [id]: URL.createObjectURL(blob) });
  }

  /**
   * The picture could not be opened (usually its owner has not sealed the key for this person yet because they have
   * not been online since): it is asked for again after a while, up to ten times.
   */
  private retryLater(id: string, sealed: boolean): void {
    const tries = (this.retries.get(id) ?? 0) + 1;
    this.retries.set(id, tries);
    if (tries <= 10) {
      setTimeout(this.ensure.bind(this, id, sealed), 30_000 * Math.min(tries, 4));
    }
  }

  /** Opens the system file picker; resolves to null when the person cancels. */
  pickFile(accept = 'image/png,image/jpeg,image/webp,image/gif,image/avif'): Promise<File | null> {
    return pickSingleFile(accept);
  }

  /** Crops the center to the target proportions and re-encodes (strips metadata and bounds the size). */
  async process(
    file: Blob,
    target: { width: number; height: number },
    options: { mime?: 'image/webp' | 'image/jpeg'; quality?: number } = {},
  ): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.max(target.width / bitmap.width, target.height / bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext('2d')!;
      context.imageSmoothingQuality = 'high';
      const width = bitmap.width * scale;
      const height = bitmap.height * scale;
      context.drawImage(
        bitmap,
        (target.width - width) / 2,
        (target.height - height) / 2,
        width,
        height,
      );
      const blob = await new Promise<Blob | null>(function encode(resolve) {
        canvas.toBlob(resolve, options.mime ?? 'image/webp', options.quality ?? 0.86);
      });
      if (!blob) {
        throw new Error('Could not encode the image');
      }
      return blob;
    } finally {
      bitmap.close();
    }
  }

  /**
   * Uploads a processed picture and returns its id. A profile picture or banner is encrypted first, and its key is sealed
   * for everybody who may see it before the id is returned.
   */
  async upload(kind: ImageKind, blob: Blob): Promise<string> {
    const plain = new Uint8Array(await blob.arrayBuffer());
    if (kind === 'group') {
      const response = await this.api.upload<{ id: string }>('/api/images?kind=group', plain);
      return response.id;
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const iv = randomBytes(12);
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plain),
    );
    const bytes = new Uint8Array(iv.length + cipher.length);
    bytes.set(iv);
    bytes.set(cipher, iv.length);
    const response = await this.api.upload<{ id: string }>('/api/images?kind=' + kind, bytes);
    this.pictureKeys.set(response.id, key);
    await this.shareMine(response.id);
    return response.id;
  }

  /**
   * Seals the key of one of the person's own pictures for everybody who may see it and does not have it yet (friends,
   * people who share a server, direct conversations). It runs after an upload and again now and then while the person is
   * online, so the people who arrive later get the picture too.
   */
  async shareMine(id: string | null | undefined): Promise<void> {
    const key = id ? this.pictureKeys.get(id) : undefined;
    if (!id || !key) {
      return;
    }
    const audience = await this.api.get<{ missing: { id: string; ecdh: string }[] }>(
      '/api/images/' + id + '/audience',
    );
    if (audience.missing.length === 0) {
      return;
    }
    const identity = this.auth.identity;
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const keys: { viewerId: string; iv: string; ciphertext: string }[] = [];
    for (const viewer of audience.missing) {
      const pair = await derivePairKey(
        identity.ecdhPrivate,
        identity.publicKeys.ecdh,
        viewer.ecdh,
        'profile-picture|' + id,
      );
      const sealed = await sealBytes(pair, raw, 'profile-picture|' + id + '|' + viewer.id);
      keys.push({ viewerId: viewer.id, iv: sealed.iv, ciphertext: sealed.ciphertext });
    }
    await this.api.put('/api/images/' + id + '/keys', { keys });
  }

  /** Whether this browser holds the key of a picture (it uploaded it in this session or already opened it). */
  holdsKey(id: string | null | undefined): boolean {
    return !!id && this.pictureKeys.has(id);
  }

  /** Opens the key of one of the person's own pictures (after a reload), then shares it with whoever is missing. */
  async shareOwn(id: string | null | undefined): Promise<void> {
    if (!id) {
      return;
    }
    try {
      const last = Number(sessionStorage.getItem('chatterly.shared.' + id) ?? 0);
      if (Date.now() - last < SHARE_AGAIN_AFTER_MS) {
        return;
      }
      await this.loadSealed(id);
      await this.shareMine(id);
      sessionStorage.setItem('chatterly.shared.' + id, String(Date.now()));
    } catch {
      /* the picture has no key for this person (an old one): nothing to share */
    }
  }

  /** A wallpaper kept only on this device, as a data URL (it never leaves the device). */
  async toWallpaperDataUrl(file: Blob): Promise<string> {
    const blob = await this.process(file, WALLPAPER_SIZE, { mime: 'image/jpeg', quality: 0.8 });
    return new Promise<string>(function read(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function loaded() {
        resolve(reader.result as string);
      };
      reader.onerror = function failed() {
        reject(reader.error);
      };
      reader.readAsDataURL(blob);
    });
  }
}
