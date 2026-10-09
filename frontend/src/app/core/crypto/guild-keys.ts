/**
 * src/app/core/crypto/guild-keys.ts
 * AES-256-GCM group keys and the encrypted envelopes that deliver them to each member.
 */
import { derivePairKey, openBytes, sealBytes } from './pairwise';

export interface KeyEnvelope {
  iv: string;
  /** AES-GCM(guild key bytes) under the pair key between wrapper and recipient. */
  data: string;
}

export interface EnvelopeContext {
  guildId: string;
  keyVersion: number;
  recipientId: string;
}

const aad = function (c: EnvelopeContext) {
  return `keywrap|${c.guildId}|${c.keyVersion}|${c.recipientId}`;
};

/**
 * A guild shares one AES-256-GCM key. It is extractable only so members can re-wrap it for people
 * they invite; it lives in memory and is never persisted in clear.
 */
export async function generateGuildKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** Encrypts the group key for one member, using a key agreed between the sender and the member. */
export async function wrapGuildKey(
  guildKey: CryptoKey,
  myPrivate: CryptoKey,
  myPublicB64: string,
  recipientPublicB64: string,
  context: EnvelopeContext,
): Promise<KeyEnvelope> {
  const pair = await derivePairKey(myPrivate, myPublicB64, recipientPublicB64, aad(context));
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', guildKey));
  const sealed = await sealBytes(pair, raw, aad(context));
  return { iv: sealed.iv, data: sealed.ciphertext };
}

/** Decrypts a group key that another member encrypted for this person. */
export async function unwrapGuildKey(
  envelope: KeyEnvelope,
  myPrivate: CryptoKey,
  myPublicB64: string,
  wrapperPublicB64: string,
  context: EnvelopeContext,
): Promise<CryptoKey> {
  const pair = await derivePairKey(myPrivate, myPublicB64, wrapperPublicB64, aad(context));
  const raw = await openBytes(pair, { iv: envelope.iv, ciphertext: envelope.data }, aad(context));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}
