/**
 * src/app/core/crypto/fingerprint.ts
 * Identity fingerprints and safety numbers used to verify contacts.
 */
import { concat, fromB64, sha256, toHex } from './bytes';
import type { PublicKeys } from './identity';

/** 64-hex SHA-256 over both public keys: a stable name for an identity. */
export async function fingerprint(keys: PublicKeys): Promise<string> {
  return toHex(await sha256(concat(fromB64(keys.ecdh), fromB64(keys.ecdsa))));
}

/** "AB12 CD34 ..." — easy to read aloud when verifying a contact. */
export function formatFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/.{1,4}/g) ?? []).join(' ');
}

/**
 * Both participants compute the same 12 groups of 5 digits. If they match when compared over a
 * trusted channel, nobody is sitting in the middle of the conversation.
 */
export async function safetyNumber(mine: PublicKeys, theirs: PublicKeys): Promise<string> {
  const [a, b] = [await fingerprint(mine), await fingerprint(theirs)].sort();
  const base = `chatterly-renewed/safety/v1|${a}|${b}`;
  const digest = concat(await sha256(base + '|1'), await sha256(base + '|2'));
  const view = new DataView(digest.buffer);
  return Array.from({ length: 12 }, function (_, i) {
    return String(view.getUint32(i * 4) % 100000).padStart(5, '0');
  }).join(' ');
}
