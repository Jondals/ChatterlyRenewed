/**
 * src/security/image-sanitize.ts
 * Server-side check and cleaning of the pictures people upload (profile pictures, banners, group icons).
 *
 * What it does: it walks the container of a PNG, JPEG, WebP or GIF, refuses files that are malformed or whose
 * dimensions are absurd (decompression bombs), and copies only the parts a picture needs to be drawn. Everything
 * that carries metadata is left out: EXIF (camera, GPS position), XMP, text chunks, comments, thumbnails.
 *
 * Why it exists: the web client already re-encodes pictures before upload (which drops the metadata), but a
 * modified client or a direct API call can send anything, and the server cannot rely on the browser. The check
 * has to run where the data is stored.
 *
 * Why this approach: the pixels are NOT decoded or re-encoded here. That would need a native image library (a big
 * new dependency and attack surface) and would cost quality. Dropping the metadata segments is lossless, needs
 * no dependency, and only parses length-prefixed containers with strict bounds checks, so malformed input is
 * rejected instead of being interpreted.
 *
 * Limits: this is a container filter, not a decoder. A file can still be an invalid image whose compressed data
 * is corrupt; the browsers that display it are the ones that decode it, and the response is sent with
 * `nosniff` and a sandboxing Content-Security-Policy.
 */

/** Longest side accepted, in pixels. Pictures are cropped to 1200 pixels by the client; this leaves a wide margin. */
export const MAX_IMAGE_SIDE = 4096;
/** Most pixels accepted: bounds the memory a browser needs to decode the picture. */
export const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;

/** A picture that passed the check, rebuilt without metadata. */
export interface CleanImage {
  mime: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  data: Buffer;
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG chunks a picture needs to be drawn (animation chunks included). Everything else is dropped. */
const PNG_KEEP = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'iCCP',
  'sBIT',
  'bKGD',
  'pHYs',
  'acTL',
  'fcTL',
  'fdAT',
]);

/** Whether the dimensions are inside the limits. */
function sizeAllowed(width: number, height: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= MAX_IMAGE_SIDE &&
    height <= MAX_IMAGE_SIDE &&
    width * height <= MAX_IMAGE_PIXELS
  );
}

/**
 * Rebuilds a PNG with only the chunks that draw it. Refuses truncated files, a missing IHDR/IDAT/IEND, unknown
 * critical chunks and oversized dimensions. Anything after IEND is discarded.
 */
function cleanPng(input: Buffer): CleanImage | null {
  if (input.length < 33 || !input.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  const parts: Buffer[] = [input.subarray(0, 8)];
  let width = 0;
  let height = 0;
  let position = 8;
  let first = true;
  let sawData = false;
  let ended = false;
  while (position + 12 <= input.length) {
    const length = input.readUInt32BE(position);
    const type = input.toString('latin1', position + 4, position + 8);
    const end = position + 12 + length;
    if (length > 0x7fffffff || end > input.length) return null;
    if (first) {
      if (type !== 'IHDR' || length !== 13) return null;
      width = input.readUInt32BE(position + 8);
      height = input.readUInt32BE(position + 12);
      if (!sizeAllowed(width, height)) return null;
      first = false;
    }
    const critical = type.charCodeAt(0) >= 0x41 && type.charCodeAt(0) <= 0x5a;
    if (critical && !PNG_KEEP.has(type)) return null;
    if (PNG_KEEP.has(type)) parts.push(input.subarray(position, end));
    if (type === 'IDAT') sawData = true;
    position = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended || !sawData) return null;
  return { mime: 'image/png', data: Buffer.concat(parts), width, height };
}

/**
 * Rebuilds a JPEG without its application segments (EXIF, XMP, Photoshop data, thumbnails) and comments. The JFIF
 * header, the colour profile and the Adobe colour marker stay because the picture is drawn wrongly without them.
 * The compressed scan data is copied untouched.
 */
function cleanJpeg(input: Buffer): CleanImage | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;
  const parts: Buffer[] = [input.subarray(0, 2)];
  let width = 0;
  let height = 0;
  let position = 2;
  while (position < input.length) {
    if (input[position] !== 0xff) return null;
    while (input[position] === 0xff) position++;
    const marker = input[position];
    position++;
    if (marker === undefined || marker === 0x00 || marker === 0xd8 || marker === 0xd9) return null;
    // Markers without a length: TEM and the restart markers.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (position + 2 > input.length) return null;
    const length = input.readUInt16BE(position);
    if (length < 2 || position + length > input.length) return null;
    const segment = input.subarray(position - 2, position + length);
    const body = input.subarray(position + 2, position + length);
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (length < 8) return null;
      height = input.readUInt16BE(position + 3);
      width = input.readUInt16BE(position + 5);
      if (!sizeAllowed(width, height)) return null;
    }
    const isApplication = marker >= 0xe0 && marker <= 0xef;
    const keep =
      marker === 0xe0 ||
      marker === 0xee ||
      (marker === 0xe2 && body.toString('latin1', 0, 11) === 'ICC_PROFILE') ||
      (!isApplication && marker !== 0xfe);
    if (keep) parts.push(segment);
    position += length;
    if (marker === 0xda) {
      // Start of scan: the rest is compressed data (and the next scans of a progressive picture) up to the end marker.
      const rest = input.subarray(position);
      const end = rest.lastIndexOf(Buffer.from([0xff, 0xd9]));
      if (end < 0 || width === 0) return null;
      parts.push(rest.subarray(0, end + 2));
      return { mime: 'image/jpeg', data: Buffer.concat(parts), width, height };
    }
  }
  return null;
}

/** Width and height of the picture of a WebP file, read from its VP8X, VP8L or VP8 chunk. */
function webpSize(type: string, data: Buffer): { width: number; height: number } | null {
  if (type === 'VP8X' && data.length >= 10) {
    return {
      width: 1 + (data[4]! | (data[5]! << 8) | (data[6]! << 16)),
      height: 1 + (data[7]! | (data[8]! << 8) | (data[9]! << 16)),
    };
  }
  if (type === 'VP8L' && data.length >= 5 && data[0] === 0x2f) {
    return {
      width: 1 + (((data[2]! & 0x3f) << 8) | data[1]!),
      height: 1 + (((data[4]! & 0x0f) << 10) | (data[3]! << 2) | ((data[2]! & 0xc0) >> 6)),
    };
  }
  if (
    type === 'VP8 ' &&
    data.length >= 10 &&
    data[3] === 0x9d &&
    data[4] === 0x01 &&
    data[5] === 0x2a
  ) {
    return { width: data.readUInt16LE(6) & 0x3fff, height: data.readUInt16LE(8) & 0x3fff };
  }
  return null;
}

/**
 * Rebuilds a WebP without its EXIF and XMP chunks (and clears their flags in the extended header). Unknown chunks
 * are dropped as well, so only what the format defines for drawing a picture is kept.
 */
function cleanWebp(input: Buffer): CleanImage | null {
  if (
    input.length < 20 ||
    input.toString('latin1', 0, 4) !== 'RIFF' ||
    input.toString('latin1', 8, 12) !== 'WEBP'
  )
    return null;
  const declared = input.readUInt32LE(4) + 8;
  if (declared > input.length || declared < 20) return null;
  const known = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);
  const chunks: Buffer[] = [];
  let size: { width: number; height: number } | null = null;
  let position = 12;
  while (position + 8 <= declared) {
    const type = input.toString('latin1', position, position + 4);
    const length = input.readUInt32LE(position + 4);
    const end = position + 8 + length;
    if (end > declared) return null;
    const data = input.subarray(position + 8, end);
    if (known.has(type)) {
      const payload = Buffer.from(data);
      if (type === 'VP8X') {
        if (payload.length < 10) return null;
        // Bits 2 (XMP) and 3 (EXIF) of the flags say that metadata chunks follow; they do not any more.
        payload[0] = payload[0]! & ~0x0c;
      }
      size ??= webpSize(type, payload);
      const header = Buffer.alloc(8);
      header.write(type, 0, 'latin1');
      header.writeUInt32LE(length, 4);
      chunks.push(header, payload);
      if (length % 2) chunks.push(Buffer.alloc(1));
    }
    position = end + (length % 2);
  }
  if (!size || !sizeAllowed(size.width, size.height) || !chunks.length) return null;
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return {
    mime: 'image/webp',
    data: Buffer.concat([header, body]),
    width: size.width,
    height: size.height,
  };
}

/** Position just after a run of GIF data sub-blocks (and its zero terminator), or -1 when it is cut short. */
function skipGifBlocks(input: Buffer, start: number): number {
  let position = start;
  while (position < input.length) {
    const length = input[position]!;
    position += 1 + length;
    if (length === 0) return position <= input.length ? position : -1;
  }
  return -1;
}

/**
 * Rebuilds a GIF without comments, plain-text overlays and application extensions other than the loop counter.
 * Frames, palettes and timing are copied as they are.
 */
function cleanGif(input: Buffer): CleanImage | null {
  const version = input.toString('latin1', 0, 6);
  if (input.length < 14 || (version !== 'GIF87a' && version !== 'GIF89a')) return null;
  const width = input.readUInt16LE(6);
  const height = input.readUInt16LE(8);
  if (!sizeAllowed(width, height)) return null;
  const packed = input[10]!;
  let position = 13 + (packed & 0x80 ? 3 * 2 ** ((packed & 7) + 1) : 0);
  if (position > input.length) return null;
  const parts: Buffer[] = [input.subarray(0, position)];
  let frames = 0;
  while (position < input.length) {
    const block = input[position]!;
    if (block === 0x3b) {
      parts.push(Buffer.from([0x3b]));
      return frames > 0 ? { mime: 'image/gif', data: Buffer.concat(parts), width, height } : null;
    }
    if (block === 0x21) {
      const label = input[position + 1];
      if (label === undefined) return null;
      const end = skipGifBlocks(input, position + 2);
      if (end < 0) return null;
      const app = input.toString('latin1', position + 3, position + 14);
      const keep =
        label === 0xf9 || (label === 0xff && (app === 'NETSCAPE2.0' || app === 'ANIMEXTS1.0'));
      if (keep) parts.push(input.subarray(position, end));
      position = end;
    } else if (block === 0x2c) {
      if (position + 10 > input.length) return null;
      const local = input[position + 9]!;
      const table = local & 0x80 ? 3 * 2 ** ((local & 7) + 1) : 0;
      const start = position + 10 + table + 1;
      if (start > input.length) return null;
      const end = skipGifBlocks(input, start);
      if (end < 0) return null;
      parts.push(input.subarray(position, end));
      frames++;
      position = end;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * Checks an uploaded picture and returns it without metadata, or null when it is not a well-formed PNG, JPEG,
 * WebP or GIF within the size limits. The type comes from the bytes, never from what the client declares.
 *
 * @param input The bytes sent by the client.
 */
export function sanitizeImage(input: Buffer): CleanImage | null {
  try {
    if (input.subarray(0, 8).equals(PNG_SIGNATURE)) return cleanPng(input);
    if (input[0] === 0xff && input[1] === 0xd8) return cleanJpeg(input);
    if (input.toString('latin1', 0, 4) === 'RIFF') return cleanWebp(input);
    if (input.toString('latin1', 0, 3) === 'GIF') return cleanGif(input);
  } catch {
    return null;
  }
  return null;
}
