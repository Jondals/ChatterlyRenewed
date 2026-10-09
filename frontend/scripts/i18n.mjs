/**
 * i18n helper.
 *   node scripts/i18n.mjs          -> prints every translatable string found in src/app
 *   node scripts/i18n.mjs --check  -> exits 1 if some string has no entry in src/app/core/i18n/es.ts
 *
 * Strings are found by the same conventions the UI uses: `'text' | t`, `.t('text')`, `title="text"` /
 * `hint="text"` on <app-setting-row>, ternaries piped through `t`, and the label/text/hint/title fields
 * of option arrays.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', 'src', 'app');
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !full.includes(path.join('core', 'i18n'))
    )
      files.push(full);
  }
})(root);

const unescape = function (s) {
  return s.split("\\'").join("'").split('\\"').join('"').split('\\\\').join('\\');
};
const found = new Map();
const add = function (text, file) {
  const t = unescape(text).trim();
  if (!t || /^[\d\s.,:;()+\-—–·|/%@#…{}]+$/.test(t) || /^[a-z]+(\.[a-z]+)+$/i.test(t)) return;
  if (!found.has(t)) found.set(t, file);
};

const SQ = "'((?:[^'\\\\\\n]|\\\\.)+)'";
const patterns = [
  new RegExp(SQ + '\\s*\\|\\s*t\\b', 'g'),
  /"((?:[^"\\\n]|\\.)+)"\s*\|\s*t\b/g,
  new RegExp('\\bt\\(\\s*' + SQ, 'g'),
  new RegExp('\\bi18n\\.t\\(\\s*' + SQ, 'g'),
  /<app-setting-row[^>]*\stitle="([^"]+)"/g,
  /<app-setting-row[^>]*\shint="([^"]+)"/g,
  new RegExp('\\b(?:label|hint|title|text|name):\\s*' + SQ, 'g'),
];
const IGNORE = new Set([
  'AES-GCM',
  'ECDH',
  'ECDSA',
  'PBKDF2',
  'HKDF',
  'Inter',
  'Outfit',
  'Space Grotesk',
  'Fraunces',
  'JetBrains Mono',
  'timestamp',
  'YOU',
  'Imported',
  'Emoji starter',
  'text',
  'emoji',
  'gif',
  'Smileys',
  'People',
  'Nature',
  'Food',
  'Activity',
  'Travel',
  'wheel',
  'video',
  'tournament',
]);

for (const file of files) {
  // A double backslash + quote inside TS template literals renders as an escaped quote in the template.
  const src = fs.readFileSync(file, 'utf8').split("\\\\'").join("\\'");
  const rel = path.relative(root, file);
  for (const re of patterns) for (const m of src.matchAll(re)) add(m[1], rel);
  // ternaries piped through t:  (cond() ? 'A' : 'B') | t   (walk back to the matching parenthesis)
  for (const m of src.matchAll(/\)\s*\|\s*t\b/g)) {
    let depth = 0;
    let start = -1;
    for (let i = m.index; i >= 0; i--) {
      if (src[i] === ')') depth++;
      else if (src[i] === '(' && --depth === 0) {
        start = i;
        break;
      }
    }
    if (start < 0) continue;
    for (const q of src.slice(start, m.index).matchAll(new RegExp(SQ, 'g'))) add(q[1], rel);
  }
}
for (const k of IGNORE) found.delete(k);

// describeError() messages
const errors = fs.readFileSync(path.join(root, 'shared', 'util', 'errors.ts'), 'utf8');
for (const m of errors.matchAll(new RegExp('^\\s+\\w+:\\s*' + SQ + ',?$', 'gm')))
  add(m[1], 'shared/util/errors.ts');
add('Cannot reach the server. Is the backend running?', 'shared/util/errors.ts');
add('Decryption failed — wrong password?', 'shared/util/errors.ts');
add('Something went wrong.', 'shared/util/errors.ts');
add('Slow down a little — too many requests.', 'shared/util/errors.ts');

const dict = fs.readFileSync(path.join(root, 'core', 'i18n', 'es.ts'), 'utf8');
const have = new Set();
for (const m of dict.matchAll(/^\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"):/gm))
  have.add(unescape(m[1] ?? m[2]));

const missing = [...found.keys()].filter(function (k) {
  return !have.has(k);
});
if (process.argv.includes('--check')) {
  if (missing.length) {
    console.error(
      `${missing.length} string(s) without a Spanish translation:\n` +
        missing
          .map(function (k) {
            return '  ' + JSON.stringify(k);
          })
          .join('\n'),
    );
    process.exit(1);
  }
  console.log(`i18n OK — ${found.size} strings, all translated.`);
} else {
  console.log(JSON.stringify([...found.keys()], null, 1));
  console.error(`\n${found.size} strings, ${missing.length} missing in es.ts`);
}
