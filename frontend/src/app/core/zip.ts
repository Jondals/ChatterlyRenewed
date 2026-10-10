/**
 * Minimal ZIP reader (stored + deflate entries) built on the browser's DecompressionStream — enough to
 * open WhatsApp `.wastickers` packs without shipping a library. Defensive limits guard against zip bombs.
 */
import { inflateRawSync } from './inflate';

export interface ZipEntry {
  name: string;
  data: Uint8Array<ArrayBuffer>;
}

const MAX_ENTRIES = 300;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;

/** True when the browser accepts the 'deflate-raw' format in its DecompressionStream. */
function supportsRawDeflate(): boolean {
  try {
    new DecompressionStream('deflate-raw');
    return true;
  } catch {
    return false;
  }
}

/** Decompresses raw deflate data using the browser's DecompressionStream (or the own decoder when it cannot). */
async function inflateRaw(
  data: Uint8Array<ArrayBuffer>,
  expected: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined' || !supportsRawDeflate()) {
    // ! Browsers that do not know 'deflate-raw' (older Safari): the own decoder.
    return inflateRawSync(data, Math.min(MAX_ENTRY_BYTES, expected + 1024));
  }
  const source = new ReadableStream<Uint8Array>({
    /** Feeds all the compressed bytes into the stream and closes it. */
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const stream = source.pipeThrough(
    new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<
      Uint8Array,
      Uint8Array
    >,
  );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > Math.min(MAX_ENTRY_BYTES, expected + 1024)) {
      await reader.cancel();
      throw new Error('Zip entry is larger than declared');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Reads a ZIP archive (as used by WhatsApp sticker packs) into a list of named files. */
export async function readZip(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65536); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  if (count > MAX_ENTRIES) throw new Error('Too many files in archive');

  const out: ZipEntry[] = [];
  let total = 0;
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Corrupt zip directory');
    const flags = view.getUint16(pos + 8, true);
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const size = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    pos += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/') || name.includes('..') || name.startsWith('/')) continue; // folders / path tricks
    if (flags & 1) throw new Error('Encrypted zip files are not supported');
    if (size > MAX_ENTRY_BYTES) continue;
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new Error('Archive is too large');

    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Corrupt zip entry');
    const dataStart =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    const raw = bytes.slice(dataStart, dataStart + compressedSize);
    if (method === 0) out.push({ name, data: raw });
    else if (method === 8) out.push({ name, data: await inflateRaw(raw, size) });
    // other compression methods are skipped
  }
  return out;
}
