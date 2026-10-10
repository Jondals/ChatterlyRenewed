/**
 * scripts/backup.mjs
 * Makes a consistent copy of the database of Chatterly-Renewed, optionally encrypted with a passphrase, and restores it.
 *
 *   node scripts/backup.mjs backup  <folder>            copy chatterly.db into <folder>/chatterly-<date>.db
 *   BACKUP_PASSPHRASE=... node scripts/backup.mjs backup <folder>   the same, encrypted (.db.enc), no plain copy is left
 *   BACKUP_PASSPHRASE=... node scripts/backup.mjs restore <file.db.enc> <target.db>   decrypts a backup
 *   (in Docker: docker compose exec app node scripts/backup.mjs backup /data/backups, then copy it off the machine)
 *
 * ? Why it exists: copying the .db file of a running SQLite database (with its -wal file) can give a broken copy. SQLite's own
 * online backup API gives a consistent snapshot without stopping the app. The database holds only ciphertext of messages,
 * but also the hashes of the passwords and the public keys of everybody, so a backup is sensitive: it is written with
 * permissions 600 and can be encrypted (AES-256-GCM, key from the passphrase with scrypt) before it leaves the machine.
 *
 * ! What it does NOT save: the uploaded files (copy the uploads folder with the same care) and secrets.json (the server
 * secrets; without SERVER_SECRET the password hashes no longer verify). Keep those in a separate, encrypted place. Never
 * restore over a running app, and never delete the original database to "test" a restore: restore to another path first.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const MAGIC = Buffer.from('CHBK1');

/** Opens better-sqlite3 from the backend (works from the repository and from the Docker image). */
function loadDatabase() {
  const require = createRequire(path.join(import.meta.dirname, '..', 'backend', 'package.json'));
  return require('better-sqlite3');
}

/** The key for a passphrase and a salt (scrypt, 32 bytes). */
function keyFor(passphrase, salt) {
  return scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
}

/** Encrypts a file into `target` (magic, salt, iv, ciphertext, tag), with permissions 600. */
function encryptFile(source, target, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(fs.readFileSync(source)), cipher.final()]);
  fs.writeFileSync(target, Buffer.concat([MAGIC, salt, iv, body, cipher.getAuthTag()]), {
    mode: 0o600,
  });
}

/** Decrypts a backup made by `encryptFile`; fails if the passphrase is wrong or the file was changed. */
function decryptFile(source, target, passphrase) {
  const data = fs.readFileSync(source);
  if (!data.subarray(0, MAGIC.length).equals(MAGIC))
    throw new Error('This is not an encrypted backup.');
  const salt = data.subarray(5, 21);
  const iv = data.subarray(21, 33);
  const tag = data.subarray(data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', keyFor(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([
    decipher.update(data.subarray(33, data.length - 16)),
    decipher.final(),
  ]);
  if (fs.existsSync(target)) throw new Error('Refusing to overwrite ' + target);
  fs.writeFileSync(target, plain, { mode: 0o600 });
}

/** Makes the snapshot (and encrypts it when BACKUP_PASSPHRASE is set). */
async function backup(folder) {
  const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), 'data'));
  const dbPath = process.env.DB_PATH ?? path.join(dataDir, 'chatterly.db');
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const plain = path.join(folder, `chatterly-${stamp}.db`);
  const Database = loadDatabase();
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(plain);
  } finally {
    db.close();
  }
  fs.chmodSync(plain, 0o600);
  const passphrase = process.env.BACKUP_PASSPHRASE;
  if (!passphrase) {
    console.log('Backup written (NOT encrypted): ' + plain);
    return;
  }
  encryptFile(plain, plain + '.enc', passphrase);
  fs.rmSync(plain);
  console.log('Encrypted backup written: ' + plain + '.enc');
}

const [command, first, second] = process.argv.slice(2);
if (command === 'backup' && first) {
  await backup(path.resolve(first));
} else if (command === 'restore' && first && second && process.env.BACKUP_PASSPHRASE) {
  decryptFile(path.resolve(first), path.resolve(second), process.env.BACKUP_PASSPHRASE);
  console.log(
    'Decrypted to ' +
      path.resolve(second) +
      ' (stop the app before using it in place of the live database).',
  );
} else {
  console.error('Usage: see the header of scripts/backup.mjs');
  process.exit(1);
}
