/**
 * src/app/core/crypto/pairwise.ts
 * Encryption, signing and verification between two people (direct messages and call signaling).
 */
import { fromB64, fromUtf8, randomBytes, toB64, utf8 } from './bytes';
import { importEcdhPublic, importEcdsaPublic } from './identity';

/** An AES-GCM encrypted blob: what the server stores and relays. Base64 fields. */
export interface Sealed {
  iv: string;
  ciphertext: string;
}

const PAD_BLOCK = 64;

/**
 * Static-static ECDH between two identities, expanded with HKDF into an AES-256-GCM key that is
 * bound to a `context` (e.g. the conversation id) and to both public keys (sorted, so both sides
 * derive the same key). Non-extractable.
 */
export async function derivePairKey(
  myPrivate: CryptoKey,
  myPublicB64: string,
  theirPublicB64: string,
  context: string,
): Promise<CryptoKey> {
  const theirPublic = await importEcdhPublic(theirPublicB64);
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const [first, second] = [myPublicB64, theirPublicB64].sort();
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: utf8(`chatterly-renewed/pair/v1|${context}|${first}|${second}`),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Pads with spaces (valid JSON whitespace) so ciphertext length only reveals a 64-byte bucket. */
function padJson(json: string): Uint8Array<ArrayBuffer> {
  const raw = utf8(json);
  const padded = new Uint8Array(Math.ceil((raw.length + 1) / PAD_BLOCK) * PAD_BLOCK).fill(0x20);
  padded.set(raw);
  return padded;
}

/** Encrypts bytes with AES-256-GCM, binding them to a context string. */
export async function sealBytes(
  key: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>,
  aad: string,
): Promise<Sealed> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8(aad), tagLength: 128 },
    key,
    plaintext,
  );
  return { iv: toB64(iv), ciphertext: toB64(ciphertext) };
}

/** Decrypts bytes sealed with sealBytes; it fails when the key or the context differ. */
export async function openBytes(
  key: CryptoKey,
  sealed: Sealed,
  aad: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: utf8(aad), tagLength: 128 },
    key,
    fromB64(sealed.ciphertext),
  );
  return new Uint8Array(plain);
}

export const seal = function (key: CryptoKey, payload: unknown, aad: string): Promise<Sealed> {
  return sealBytes(key, padJson(JSON.stringify(payload)), aad);
};

/** Decrypts a sealed value and parses it as JSON. */
export async function open<T>(key: CryptoKey, sealed: Sealed, aad: string): Promise<T> {
  return JSON.parse(fromUtf8(await openBytes(key, sealed, aad))) as T;
}

// ---- authenticity: ECDSA signatures over the sealed blob + its context --------------------------

const sigInput = function (context: string, sealed: Sealed) {
  return utf8(`chatterly-renewed/sig/v1|${context}|${sealed.iv}|${sealed.ciphertext}`);
};

/** Signs a sealed value (and its context) with the sender's signing key. */
export async function signSealed(
  ecdsaPrivate: CryptoKey,
  context: string,
  sealed: Sealed,
): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    ecdsaPrivate,
    sigInput(context, sealed),
  );
  return toB64(sig);
}

/** Checks the signature of a sealed value against the sender's public signing key. */
export async function verifySealed(
  signerEcdsaPublicB64: string,
  context: string,
  sealed: Sealed,
  signatureB64: string,
): Promise<boolean> {
  try {
    const key = await importEcdsaPublic(signerEcdsaPublicB64);
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      fromB64(signatureB64),
      sigInput(context, sealed),
    );
  } catch {
    return false;
  }
}

// ---- context strings (also used as AES-GCM additional data) -------------------------------------

export const messageContext = function (channelId: string, senderId: string, keyVersion: number) {
  return `msg|${channelId}|${senderId}|${keyVersion}`;
};

export const reactionContext = function (
  channelId: string,
  messageId: string,
  userId: string,
  keyVersion: number,
) {
  return `reaction|${channelId}|${messageId}|${userId}|${keyVersion}`;
};

export const signalContext = function (roomId: string, from: string, to: string) {
  return `rtc|${roomId}|${from}|${to}`;
};
