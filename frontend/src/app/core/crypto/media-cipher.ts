/**
 * End-to-end encryption of call media frames (WebRTC Insertable Streams).
 *
 * DTLS-SRTP already protects each hop, but a relay (TURN) or a compromised endpoint of that layer would
 * still see plaintext frames. This layer encrypts every encoded audio/video frame with AES-256-GCM
 * *before* it is packetised, using keys derived from an ephemeral ECDH exchange that is carried inside
 * the identity-signed signaling. Properties:
 *
 *  - Forward secrecy: the ECDH keys are generated per call and per peer and discarded afterwards.
 *  - Key ratchet: the send key is replaced every `RATCHET_MS` by a one-way function of the previous one,
 *    so a key leaked mid-call cannot decrypt earlier media.
 *  - Directional keys: A→B and B→A never share key material.
 *  - Frame header bytes (codec descriptors) stay in clear and are authenticated as AAD.
 *  - Replay and tamper detection; fail-closed (frames that cannot be authenticated are dropped).
 *
 * Frame layout:  header (n bytes, clear) ‖ AES-GCM(payload ‖ tag16) ‖ counter(8) ‖ keyId(1)
 *
 * This file is pure TypeScript (no Angular), shared by the Web Worker and the unit tests.
 */

export const TRAILER_BYTES = 9;
export const TAG_BYTES = 16;
export const RATCHET_MS = 30_000;
/** How many epochs ahead a receiver is willing to follow a sender's ratchet. */
const MAX_RATCHET_JUMP = 32;
const REPLAY_WINDOW = 512;

const enc = new TextEncoder();

export type MediaKind = 'audio' | 'video';

/** Bytes left unencrypted at the start of a frame so packetisers/depacketisers keep working. */
export function clearHeaderBytes(kind: MediaKind, isKeyFrame: boolean): number {
  if (kind === 'audio') return 1; // Opus TOC byte
  return isKeyFrame ? 10 : 3; // VP8 payload descriptor + frame tag
}

/** Derives key material from a secret with HKDF-SHA-256 and a label. */
async function hkdf(
  secret: Uint8Array<ArrayBuffer>,
  info: string,
  bytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: enc.encode('chatterly-renewed/media/v1|' + info),
    },
    base,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** Directional 32-byte secrets for one peer link, from the raw ECDH output. */
export async function deriveLinkSecrets(
  sharedBits: ArrayBuffer,
  localId: string,
  remoteId: string,
): Promise<{ send: Uint8Array<ArrayBuffer>; recv: Uint8Array<ArrayBuffer> }> {
  const shared = new Uint8Array(sharedBits);
  return {
    send: await hkdf(shared, `dir|${localId}>${remoteId}`, 32),
    recv: await hkdf(shared, `dir|${remoteId}>${localId}`, 32),
  };
}

interface Epoch {
  keyId: number;
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
}

/** Builds the encryption key of one epoch of the call key chain. */
async function openEpoch(secret: Uint8Array<ArrayBuffer>, keyId: number): Promise<Epoch> {
  const raw = await hkdf(secret, 'key', 32);
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  raw.fill(0);
  return { keyId, key, salt: await hkdf(secret, 'salt', 4) };
}

/** One direction of one link: current epoch, ratchet state, counters and replay window. */
export class MediaKeyChain {
  private secret: Uint8Array<ArrayBuffer>;
  private epoch!: Epoch;
  private previous: Epoch | null = null;
  private counter = 0;
  private startedAt = Date.now();
  private seen = new Set<number>();
  private highest = -1;

  /** Starts a key chain from a secret. */
  private constructor(secret: Uint8Array<ArrayBuffer>) {
    this.secret = secret;
  }

  /** Creates a key chain and its first epoch from a shared secret. */
  static async create(secret: Uint8Array<ArrayBuffer>): Promise<MediaKeyChain> {
    const chain = new MediaKeyChain(new Uint8Array(secret));
    chain.epoch = await openEpoch(chain.secret, 0);
    return chain;
  }

  /** Number of the current key epoch. */
  get keyId(): number {
    return this.epoch.keyId;
  }

  /** Moves to the next epoch: the secret is ratcheted forward and the old one is erased. */
  private async step(): Promise<void> {
    const next = await hkdf(this.secret, 'ratchet', 32);
    this.secret.fill(0); // the old secret is gone for good
    this.secret = next;
    this.previous = this.epoch;
    this.epoch = await openEpoch(next, (this.epoch.keyId + 1) & 0xff);
    this.counter = 0;
    this.seen.clear();
    this.highest = -1;
    this.startedAt = Date.now();
  }

  /** Sender side: rotate when the current epoch is older than `RATCHET_MS`. */
  async maybeRatchet(now = Date.now()): Promise<void> {
    if (now - this.startedAt >= RATCHET_MS) await this.step();
  }

  /** Encrypts one media frame, leaving its codec header readable so the media pipeline keeps working. */
  async encrypt(frame: ArrayBuffer, headerBytes: number): Promise<ArrayBuffer> {
    const data = new Uint8Array(frame);
    const header = Math.min(headerBytes, data.length);
    const counter = this.counter++;
    const trailer = new Uint8Array(TRAILER_BYTES);
    const view = new DataView(trailer.buffer);
    view.setUint32(0, Math.floor(counter / 2 ** 32));
    view.setUint32(4, counter >>> 0);
    trailer[8] = this.epoch.keyId;

    const iv = new Uint8Array(12);
    iv.set(this.epoch.salt, 0);
    iv.set(trailer.subarray(0, 8), 4);
    const aad = new Uint8Array(header + TRAILER_BYTES);
    aad.set(data.subarray(0, header));
    aad.set(trailer, header);

    const sealed = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
        this.epoch.key,
        data.subarray(header),
      ),
    );
    const out = new Uint8Array(header + sealed.length + TRAILER_BYTES);
    out.set(data.subarray(0, header));
    out.set(sealed, header);
    out.set(trailer, header + sealed.length);
    return out.buffer;
  }

  /** Throws when the frame is forged, corrupted, replayed or uses a key we cannot follow. */
  async decrypt(frame: ArrayBuffer, headerBytes: number): Promise<ArrayBuffer> {
    const data = new Uint8Array(frame);
    const plainLength = data.length - TAG_BYTES - TRAILER_BYTES;
    if (plainLength < 0) throw new Error('frame too short');
    // Frames shorter than the nominal header were sent entirely in clear (just authenticated).
    const header = Math.min(headerBytes, plainLength);
    const trailer = data.subarray(data.length - TRAILER_BYTES);
    const view = new DataView(trailer.buffer, trailer.byteOffset, TRAILER_BYTES);
    const counter = view.getUint32(0) * 2 ** 32 + view.getUint32(4);
    const keyId = trailer[8]!;

    let epoch = this.epoch;
    // A ratchet step is only *committed* after the frame authenticates, so forged frames carrying a
    // bogus key id cannot push the receiver's key chain out of sync.
    let pending: { secret: Uint8Array<ArrayBuffer>; epoch: Epoch; before: Epoch } | null = null;
    if (keyId !== epoch.keyId) {
      if (this.previous && keyId === this.previous.keyId) epoch = this.previous;
      else {
        const jump = (keyId - epoch.keyId + 256) & 0xff;
        if (jump === 0 || jump > MAX_RATCHET_JUMP) throw new Error('unknown key id');
        let secret = this.secret;
        let ahead = this.epoch;
        let before = this.epoch;
        for (let i = 0; i < jump; i++) {
          const next = await hkdf(secret, 'ratchet', 32);
          before = ahead;
          ahead = await openEpoch(next, (ahead.keyId + 1) & 0xff);
          secret = next;
        }
        pending = { secret, epoch: ahead, before };
        epoch = ahead;
      }
    }
    const current = epoch === this.epoch;
    if (current) {
      if (this.seen.has(counter) || (this.highest >= 0 && this.highest - counter >= REPLAY_WINDOW))
        throw new Error('replayed frame');
    }

    const iv = new Uint8Array(12);
    iv.set(epoch.salt, 0);
    iv.set(trailer.subarray(0, 8), 4);
    const aad = new Uint8Array(header + TRAILER_BYTES);
    aad.set(data.subarray(0, header));
    aad.set(trailer, header);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
        epoch.key,
        data.subarray(header, data.length - TRAILER_BYTES),
      ),
    );
    if (pending) {
      this.secret.fill(0);
      this.secret = pending.secret;
      this.previous = pending.before;
      this.epoch = pending.epoch;
      this.counter = 0;
      this.seen.clear();
      this.highest = -1;
      this.startedAt = Date.now();
    }
    if (current || pending) {
      this.seen.add(counter);
      this.highest = Math.max(this.highest, counter);
      if (this.seen.size > REPLAY_WINDOW * 2)
        for (const c of this.seen) if (this.highest - c >= REPLAY_WINDOW) this.seen.delete(c);
    }
    const out = new Uint8Array(header + plain.length);
    out.set(data.subarray(0, header));
    out.set(plain, header);
    return out.buffer;
  }
}

/**
 * Short authentication string: both sides compute the same eight digits ("1234 5678") from the (signed)
 * ephemeral public keys. If they match when compared aloud, nobody modified the key exchange.
 */
export async function securityCode(ephemeralA: string, ephemeralB: string): Promise<string> {
  const [x, y] = [ephemeralA, ephemeralB].sort();
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', enc.encode(`chatterly-renewed/sas/v1|${x}|${y}`)),
  );
  const number = ((digest[0]! << 24) | (digest[1]! << 16) | (digest[2]! << 8) | digest[3]!) >>> 0;
  const digits = String(number % 100_000_000).padStart(8, '0');
  return digits.slice(0, 4) + ' ' + digits.slice(4);
}
