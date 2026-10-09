/**
 * src/app/core/crypto/identity.ts
 * The person's cryptographic identity: ECDH and ECDSA keys and their protection with the password.
 */
import { concat, fromB64, randomBytes, toB64, utf8 } from './bytes';

export interface PublicKeys {
  /** Base64 of the 65-byte uncompressed P-256 point used for ECDH. */
  ecdh: string;
  /** Base64 of the 65-byte uncompressed P-256 point used for ECDSA signatures. */
  ecdsa: string;
}

/** AES-GCM(iv ‖ PKCS#8) of each private key, encrypted under the password-derived wrapping key. */
export interface WrappedKeys {
  ecdh: string;
  ecdsa: string;
}

export interface Identity {
  /** Non-extractable: usable by this origin, but never readable as bytes. */
  ecdhPrivate: CryptoKey;
  ecdsaPrivate: CryptoKey;
  publicKeys: PublicKeys;
}

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const aad = function (which: 'ecdh' | 'ecdsa') {
  return utf8(`chatterly-renewed/identity/${which}/v1`);
};

/** Encrypts a private key with the wrapping key derived from the password. */
async function wrap(
  privateKey: CryptoKey,
  wrappingKey: CryptoKey,
  which: 'ecdh' | 'ecdsa',
): Promise<string> {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey('pkcs8', privateKey, wrappingKey, {
    name: 'AES-GCM',
    iv,
    additionalData: aad(which),
  });
  return toB64(concat(iv, new Uint8Array(wrapped)));
}

/** Decrypts a private key encrypted with the wrapping key (non-extractable unless asked). */
async function unwrap(
  blob: string,
  wrappingKey: CryptoKey,
  which: 'ecdh' | 'ecdsa',
  extractable: boolean,
): Promise<CryptoKey> {
  const bytes = fromB64(blob);
  return crypto.subtle.unwrapKey(
    'pkcs8',
    bytes.subarray(12),
    wrappingKey,
    { name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: aad(which) },
    which === 'ecdh' ? ECDH : ECDSA,
    extractable,
    which === 'ecdh' ? ['deriveBits'] : ['sign'],
  );
}

/** Imports a public ECDH key given as base64. */
export async function importEcdhPublic(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromB64(b64), ECDH, true, []);
}

/** Imports a public ECDSA key given as base64. */
export async function importEcdsaPublic(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromB64(b64), ECDSA, true, ['verify']);
}

/** Generates both key pairs once, at registration. */
export async function createIdentity(wrappingKey: CryptoKey): Promise<{
  identity: Identity;
  publicKeys: PublicKeys;
  wrappedKeys: WrappedKeys;
}> {
  const ecdh = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
  const ecdsa = await crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify']);
  const publicKeys: PublicKeys = {
    ecdh: toB64(await crypto.subtle.exportKey('raw', ecdh.publicKey)),
    ecdsa: toB64(await crypto.subtle.exportKey('raw', ecdsa.publicKey)),
  };
  const wrappedKeys: WrappedKeys = {
    ecdh: await wrap(ecdh.privateKey, wrappingKey, 'ecdh'),
    ecdsa: await wrap(ecdsa.privateKey, wrappingKey, 'ecdsa'),
  };
  // Drop the extractable originals: from here on only non-extractable copies exist in memory.
  const identity = await unlockIdentity(wrappedKeys, wrappingKey, publicKeys);
  return { identity, publicKeys, wrappedKeys };
}

/** Raw uncompressed point (0x04 ‖ x ‖ y) from a private key's JWK. */
function rawPublicFromJwk(jwk: JsonWebKey): string {
  const part = function (v: string) {
    return fromB64(
      v
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(v.length / 4) * 4, '='),
    );
  };
  return toB64(concat(new Uint8Array([4]), part(jwk.x!), part(jwk.y!)));
}

/**
 * Decrypts the stored private keys. Throws if the password (wrapping key) is wrong.
 * The keys are briefly extractable so we can check they really belong to `publicKeys` (a server
 * cannot slip us someone else's public key), then re-imported as non-extractable.
 */
export async function unlockIdentity(
  wrapped: WrappedKeys,
  wrappingKey: CryptoKey,
  publicKeys: PublicKeys,
): Promise<Identity> {
  const strengthen = async function (which: 'ecdh' | 'ecdsa'): Promise<CryptoKey> {
    const temp = await unwrap(wrapped[which], wrappingKey, which, true);
    const claimed = which === 'ecdh' ? publicKeys.ecdh : publicKeys.ecdsa;
    if (rawPublicFromJwk(await crypto.subtle.exportKey('jwk', temp)) !== claimed) {
      throw new Error('Stored identity does not match the advertised public key');
    }
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', temp));
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pkcs8,
      which === 'ecdh' ? ECDH : ECDSA,
      false,
      which === 'ecdh' ? ['deriveBits'] : ['sign'],
    );
    pkcs8.fill(0);
    return key;
  };
  return {
    ecdhPrivate: await strengthen('ecdh'),
    ecdsaPrivate: await strengthen('ecdsa'),
    publicKeys,
  };
}

/** Password change: re-encrypt the same private keys under a new wrapping key. */
export async function rewrapIdentity(
  wrapped: WrappedKeys,
  oldKey: CryptoKey,
  newKey: CryptoKey,
): Promise<WrappedKeys> {
  const ecdh = await unwrap(wrapped.ecdh, oldKey, 'ecdh', true);
  const ecdsa = await unwrap(wrapped.ecdsa, oldKey, 'ecdsa', true);
  return { ecdh: await wrap(ecdh, newKey, 'ecdh'), ecdsa: await wrap(ecdsa, newKey, 'ecdsa') };
}
