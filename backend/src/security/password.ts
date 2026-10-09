/**
 * src/security/password.ts
 * scrypt hash of the authentication secret and constant-time comparison.
 */
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

const KEY_LEN = 64;

/** Runs scrypt (a slow hash that needs a lot of memory, to make guessing passwords expensive). */
function derive(secret: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise(function (resolve, reject) {
    scrypt(
      secret,
      salt,
      KEY_LEN,
      {
        N: params.N,
        r: params.r,
        p: params.p,
        maxmem: 256 * params.N * params.r,
      },
      function (err, key) {
        return err ? reject(err) : resolve(key);
      },
    );
  });
}

/**
 * Mixes the secret of the server into what is hashed (a "pepper"). The pepper does not live in the database, so a
 * stolen copy of the database alone cannot even be attacked by guessing passwords.
 */
function pepperSecret(secret: string, pepper: string): string {
  return createHmac('sha256', pepper).update(secret).digest('base64');
}

/**
 * The value hashed here is NOT the user's password. The browser first stretches the password with
 * PBKDF2 (600k rounds) and sends only the "auth half" of the output. The server mixes in its own secret and hashes
 * that with scrypt, so a database leak exposes neither the password nor the key wrapping the identity.
 * Format: scryptp$N$r$p$salt$hash (the older "scrypt" format, without the pepper, is still checked and upgraded).
 */
export async function hashAuthSecret(
  secret: string,
  params: ScryptParams,
  pepper: string,
): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(pepperSecret(secret, pepper), salt, params);
  return [
    'scryptp',
    params.N,
    params.r,
    params.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

/** True when a stored hash was made without the pepper and should be made again after a good sign-in. */
export function needsUpgrade(stored: string): boolean {
  return stored.startsWith('scrypt$');
}

/** Checks the proof of a password against the stored hash in constant time. */
export async function verifyAuthSecret(
  secret: string,
  stored: string,
  pepper: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || (parts[0] !== 'scrypt' && parts[0] !== 'scryptp')) return false;
  const params = {
    N: Number(parts[1]),
    r: Number(parts[2]),
    p: Number(parts[3]),
  };
  const salt = Buffer.from(parts[4]!, 'base64');
  const expected = Buffer.from(parts[5]!, 'base64');
  const input = parts[0] === 'scryptp' ? pepperSecret(secret, pepper) : secret;
  const actual = await derive(input, salt, params);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
