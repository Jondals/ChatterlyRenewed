/**
 * src/app/core/services/image.service.ts
 * Picking, cropping, re-encoding and uploading of profile pictures, banners and group icons, and loading
 * them back as blob URLs.
 */
import { Injectable, inject, signal } from '@angular/core';
import { pickFile as pickSingleFile } from '../file-picker';
import { ApiService } from './api.service';

export type ImageKind = 'avatar' | 'banner' | 'group';

/** Final size of each kind of picture, in pixels. */
export const IMAGE_PRESETS: Record<ImageKind, { width: number; height: number }> = {
  avatar: { width: 256, height: 256 },
  group: { width: 256, height: 256 },
  banner: { width: 1200, height: 400 },
};

/** Size of a wallpaper that stays on this device. */
const WALLPAPER_SIZE = { width: 1920, height: 1080 };

/**
 * Profile pictures, banners and group icons. Pictures are center-cropped and re-encoded to WebP in the
 * browser before upload (which also strips EXIF/location metadata), then fetched back through the
 * authenticated API as blob URLs so the strict CSP never has to allow remote images.
 */
/** The biggest animated picture kept as it is (the server accepts up to 2 MB). */
const ANIMATED_MAX_BYTES = 2 * 1024 * 1024 - 2048;

@Injectable({ providedIn: 'root' })
export class ImageService {
  private readonly api = inject(ApiService);
  private readonly urls = signal<Record<string, string>>({});
  private readonly inflight = new Set<string>();

  /** Reactive: the blob URL of an image once it has loaded (null before). Call `ensure` to start loading. */
  url(id: string | null | undefined): string | null {
    return id ? (this.urls()[id] ?? null) : null;
  }

  /** Starts downloading an image if it is not loaded or loading yet. */
  ensure(id: string | null | undefined): void {
    if (!id || this.urls()[id] || this.inflight.has(id)) {
      return;
    }
    this.inflight.add(id);
    this.api
      .download('/api/images/' + id)
      .then(this.storeImage.bind(this, id), this.ignore)
      .finally(this.inflight.delete.bind(this.inflight, id));
  }

  /** Keeps a downloaded image as a blob URL. */
  private storeImage(id: string, bytes: ArrayBuffer): void {
    this.urls.set({ ...this.urls(), [id]: URL.createObjectURL(new Blob([bytes])) });
  }

  /** A failed download is not reported: the picture simply stays missing. */
  private ignore(): void {
    return;
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

  /** True for a GIF or an animated WebP (a picture that moves). */
  async isAnimated(file: Blob): Promise<boolean> {
    const head = new Uint8Array(await file.slice(0, 256).arrayBuffer());
    const text = String.fromCharCode(...head);
    if (text.startsWith('GIF8')) {
      return true;
    }
    return text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP' && text.includes('ANIM');
  }

  /**
   * Gets a picture ready for a profile, a banner or a group: a picture that moves (GIF or animated WebP, up to 2 MB)
   * is kept as it is so it keeps moving; any other is cropped and re-encoded.
   */
  async prepare(file: Blob, target: { width: number; height: number }): Promise<Blob> {
    if (file.size <= ANIMATED_MAX_BYTES && (await this.isAnimated(file))) {
      return file;
    }
    return this.process(file, target);
  }

  /** Uploads a processed picture and returns its id. */
  async upload(kind: ImageKind, blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const response = await this.api.upload<{ id: string }>('/api/images?kind=' + kind, bytes);
    return response.id;
  }

  /** Pick, crop and upload in one go. Returns the new image id, or null when the person cancels. */
  async pickAndUpload(kind: ImageKind): Promise<string | null> {
    const file = await this.pickFile();
    if (!file) {
      return null;
    }
    const blob = await this.prepare(file, IMAGE_PRESETS[kind]);
    return this.upload(kind, blob);
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
