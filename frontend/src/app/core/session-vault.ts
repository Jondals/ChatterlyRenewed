/**
 * src/app/core/session-vault.ts
 * Keeps the tokens of the session encrypted on this device. The key that encrypts them is a non-extractable
 * AES-GCM key kept in IndexedDB: a copy of the files of the browser (or a look at the storage with a tool) shows
 * only encrypted text, never a token that could be used.
 */
import { fromB64, randomBytes, toB64 } from './crypto/bytes';
import { runInStore, type StoreLocation } from './indexed-db';

const LOCATION: StoreLocation = { database: 'chatterly-renewed-vault', store: 'vault' };
const KEY_NAME = 'session-key';
/** Marks a text that is encrypted by this vault. */
const PREFIX = 'v1.';

/** The key of the vault; it is created the first time and can never be read out, only used. */
async function vaultKey(): Promise<CryptoKey> {
  const found = await runInStore<CryptoKey | undefined>(
    LOCATION,
    'readonly',
    function read(store: IDBObjectStore) {
      return store.get(KEY_NAME);
    },
  );
  if (found) {
    return found;
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await runInStore(LOCATION, 'readwrite', function write(store: IDBObjectStore) {
    return store.put(key, KEY_NAME);
  });
  return key;
}

/** Encrypts a text; the result is safe to keep in localStorage. */
export async function sealText(text: string): Promise<string> {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    await vaultKey(),
    new TextEncoder().encode(text),
  );
  return PREFIX + toB64(iv) + '.' + toB64(new Uint8Array(data));
}

/** Decrypts what sealText made; null when it is not from this vault or the key is gone. */
export async function openText(sealed: string): Promise<string | null> {
  if (!sealed.startsWith(PREFIX)) {
    return null;
  }
  try {
    const [iv, data] = sealed.slice(PREFIX.length).split('.');
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(iv!) as BufferSource },
      await vaultKey(),
      fromB64(data!) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Deletes the key: what was sealed with it can never be opened again (sign out). */
export async function forgetVault(): Promise<void> {
  try {
    await runInStore(LOCATION, 'readwrite', function clear(store: IDBObjectStore) {
      return store.clear();
    });
  } catch {
    // Nothing was stored.
  }
}
