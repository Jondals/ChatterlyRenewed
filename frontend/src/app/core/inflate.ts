/**
 * src/app/core/inflate.ts
 * A small decoder of raw deflate data (RFC 1951) for the browsers whose DecompressionStream does not know
 * 'deflate-raw' (older Safari). The sticker packs of WhatsApp are zip files and need it.
 */

/** Order in which the lengths of the code length codes are stored. */
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
/** Base length and extra bits of the length symbols 257 to 285. */
const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
/** Base distance and extra bits of the distance symbols 0 to 29. */
const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

/** A canonical Huffman code: how many codes there are of each length and the symbols in order. */
interface Huffman {
  counts: number[];
  symbols: number[];
}

/** Builds the Huffman code of a list of code lengths. */
function buildHuffman(lengths: number[]): Huffman {
  const counts = new Array<number>(16).fill(0);
  for (const length of lengths) {
    counts[length]++;
  }
  counts[0] = 0;
  const offsets = new Array<number>(16).fill(0);
  for (let length = 1; length < 15; length++) {
    offsets[length + 1] = offsets[length] + counts[length];
  }
  const symbols = new Array<number>(lengths.length).fill(0);
  for (let symbol = 0; symbol < lengths.length; symbol++) {
    if (lengths[symbol] !== 0) {
      symbols[offsets[lengths[symbol]]++] = symbol;
    }
  }
  return { counts, symbols };
}

/** The fixed codes of the blocks of type 1. */
function fixedCodes(): { literals: Huffman; distances: Huffman } {
  const lengths = new Array<number>(288).fill(8);
  for (let i = 144; i < 256; i++) lengths[i] = 9;
  for (let i = 256; i < 280; i++) lengths[i] = 7;
  return {
    literals: buildHuffman(lengths),
    distances: buildHuffman(new Array<number>(30).fill(5)),
  };
}

/** Reads bits and bytes of the compressed data. */
class BitReader {
  private position = 0;
  private bitBuffer = 0;
  private bitCount = 0;

  constructor(private readonly data: Uint8Array) {}

  /** Reads some bits (the first one read is the lowest). */
  bits(count: number): number {
    while (this.bitCount < count) {
      if (this.position >= this.data.length) {
        throw new Error('The compressed data ended too soon');
      }
      this.bitBuffer |= this.data[this.position++] << this.bitCount;
      this.bitCount += 8;
    }
    const value = this.bitBuffer & ((1 << count) - 1);
    this.bitBuffer >>>= count;
    this.bitCount -= count;
    return value;
  }

  /** Decodes one symbol with a Huffman code. */
  symbol(code: Huffman): number {
    let first = 0;
    let index = 0;
    let current = 0;
    for (let length = 1; length <= 15; length++) {
      current |= this.bits(1);
      const count = code.counts[length];
      if (current - count < first) {
        return code.symbols[index + (current - first)];
      }
      index += count;
      first = (first + count) << 1;
      current <<= 1;
    }
    throw new Error('Invalid code in the compressed data');
  }

  /** Throws away the bits left of the current byte and reads a block of bytes. */
  bytes(count: number): Uint8Array {
    this.bitBuffer = 0;
    this.bitCount = 0;
    if (this.position + count > this.data.length) {
      throw new Error('The compressed data ended too soon');
    }
    const block = this.data.subarray(this.position, this.position + count);
    this.position += count;
    return block;
  }
}

/** Decompresses raw deflate data; fails when the result would be bigger than `limit` bytes. */
export function inflateRawSync(data: Uint8Array, limit: number): Uint8Array<ArrayBuffer> {
  const reader = new BitReader(data);
  let output = new Uint8Array(Math.min(Math.max(data.length * 4, 1024), limit));
  let size = 0;

  /** Makes room for more bytes, up to the limit. */
  function reserve(extra: number): void {
    if (size + extra > limit) {
      throw new Error('Zip entry is larger than declared');
    }
    if (size + extra > output.length) {
      const bigger = new Uint8Array(Math.min(limit, Math.max(output.length * 2, size + extra)));
      bigger.set(output.subarray(0, size));
      output = bigger;
    }
  }

  const fixed = fixedCodes();
  let last = false;
  while (!last) {
    last = reader.bits(1) === 1;
    const type = reader.bits(2);
    if (type === 0) {
      const header = reader.bytes(4);
      const length = header[0] | (header[1] << 8);
      const block = reader.bytes(length);
      reserve(length);
      output.set(block, size);
      size += length;
      continue;
    }
    let literals = fixed.literals;
    let distances = fixed.distances;
    if (type === 2) {
      const literalCount = reader.bits(5) + 257;
      const distanceCount = reader.bits(5) + 1;
      const lengthCount = reader.bits(4) + 4;
      const lengthLengths = new Array<number>(19).fill(0);
      for (let i = 0; i < lengthCount; i++) {
        lengthLengths[CODE_LENGTH_ORDER[i]] = reader.bits(3);
      }
      const lengthCode = buildHuffman(lengthLengths);
      const lengths: number[] = [];
      while (lengths.length < literalCount + distanceCount) {
        const symbol = reader.symbol(lengthCode);
        if (symbol < 16) {
          lengths.push(symbol);
        } else if (symbol === 16) {
          if (lengths.length === 0) throw new Error('Invalid code lengths');
          const repeat = 3 + reader.bits(2);
          const previous = lengths[lengths.length - 1];
          for (let i = 0; i < repeat; i++) lengths.push(previous);
        } else {
          const repeat = symbol === 17 ? 3 + reader.bits(3) : 11 + reader.bits(7);
          for (let i = 0; i < repeat; i++) lengths.push(0);
        }
      }
      literals = buildHuffman(lengths.slice(0, literalCount));
      distances = buildHuffman(lengths.slice(literalCount, literalCount + distanceCount));
    } else if (type !== 1) {
      throw new Error('Invalid block of compressed data');
    }
    for (;;) {
      const symbol = reader.symbol(literals);
      if (symbol < 256) {
        reserve(1);
        output[size++] = symbol;
      } else if (symbol === 256) {
        break;
      } else {
        const index = symbol - 257;
        if (index >= LENGTH_BASE.length) throw new Error('Invalid length in the compressed data');
        const length = LENGTH_BASE[index] + reader.bits(LENGTH_EXTRA[index]);
        const distanceSymbol = reader.symbol(distances);
        if (distanceSymbol >= DISTANCE_BASE.length) throw new Error('Invalid distance');
        const distance =
          DISTANCE_BASE[distanceSymbol] + reader.bits(DISTANCE_EXTRA[distanceSymbol]);
        if (distance > size) throw new Error('Invalid distance in the compressed data');
        reserve(length);
        for (let i = 0; i < length; i++) {
          output[size] = output[size - distance];
          size++;
        }
      }
    }
  }
  const result = new Uint8Array(size);
  result.set(output.subarray(0, size));
  return result;
}
