/**
 * src/routes/auth.ts
 * Registration, zero-knowledge sign in, token renewal and sign out, and profile editing.
 */
import { createHash, createPublicKey, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context';
import { getUser, toPublicUser, presenceAudience, type UserRow } from '../models';
import { hashAuthSecret, verifyAuthSecret, needsUpgrade } from '../security/password';
import { deleteImage, ownsImage } from './images';
import {
  authSecretField,
  b64Field,
  publicKeyField,
  usernameField,
  callerId,
  cleanText,
} from '../validation';

export const ACCENTS = [
  'mint',
  'violet',
  'coral',
  'quantum',
  'obsidian',
  'rose',
  'amber',
  'lime',
  'indigo',
  'custom',
] as const;
export const NAME_FONTS = [
  'default',
  'display',
  'tech',
  'serif',
  'mono',
  'hand',
  'script',
  'arcade',
  'orbit',
  'elegant',
  'condensed',
  'marker',
  'rounded',
] as const;
const HEX = '^#[0-9a-fA-F]{6}$';
const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
export const AURAS = [
  'void',
  'prism',
  'pulse',
  'orbit',
  'dashed',
  'double',
  'glow',
  'ticks',
  'glitch',
  'rainbow',
  // Older effects: still accepted so existing profiles keep working.
  'solar',
  'aurora',
  'ocean',
  'neon',
  'sakura',
  'lava',
  'ice',
  'gold',
  'matrix',
  'galaxy',
] as const;

const sha256 = function (value: string) {
  return createHash('sha256').update(value).digest('hex');
};

const SPKI_P256_PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');

/** Rejects points that are not on the P-256 curve (invalid-curve attacks). */
function isValidP256Point(b64: string): boolean {
  try {
    const raw = Buffer.from(b64, 'base64');
    if (raw.length !== 65 || raw[0] !== 0x04) return false;
    // Importing as SPKI makes OpenSSL verify the point really lies on the curve.
    createPublicKey({
      key: Buffer.concat([SPKI_P256_PREFIX, raw]),
      format: 'der',
      type: 'spki',
    });
    return true;
  } catch {
    return false;
  }
}

const wrappedField = b64Field(100, 1024);

const wrappedKeysSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ecdh', 'ecdsa'],
  properties: { ecdh: wrappedField, ecdsa: wrappedField },
} as const;

const registerSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['username', 'authSecret', 'kdfSalt', 'kdfIterations', 'publicKeys', 'wrappedKeys'],
    properties: {
      username: usernameField,
      displayName: { type: 'string', minLength: 1, maxLength: 32 },
      authSecret: authSecretField,
      kdfSalt: b64Field(16, 64),
      kdfIterations: { type: 'integer', maximum: 5_000_000 },
      publicKeys: {
        type: 'object',
        additionalProperties: false,
        required: ['ecdh', 'ecdsa'],
        properties: { ecdh: publicKeyField, ecdsa: publicKeyField },
      },
      wrappedKeys: wrappedKeysSchema,
    },
  },
} as const;

const clean = cleanText;

/**
 * Registers the routes of the accounts: sign-up, sign-in, sessions, profile and password. Passwords are never received in clear.
 */
export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, config } = ctx;
  const authLimit = {
    config: {
      rateLimit: {
        max: config.rateLimit.authMax,
        timeWindow: config.rateLimit.windowMs,
      },
    },
  };

  /**
   * Creates the pair of tokens of a session: a short access token and a long refresh token that is stored only as a hash.
   */
  function issueTokens(userId: string) {
    const accessToken = app.jwt.sign({ sub: userId }, { expiresIn: config.accessTtlSec });
    const refreshToken = randomBytes(32).toString('base64url');
    const now = Date.now();
    db.prepare(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?,?,?,?,?)',
    ).run(randomUUID(), userId, sha256(refreshToken), now + config.refreshTtlSec * 1000, now);
    // Opportunistic cleanup of dead sessions, and a limit of 20 open ones per person (the oldest close first).
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
    db.prepare(
      'DELETE FROM sessions WHERE user_id = ? AND id NOT IN (SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20)',
    ).run(userId, userId);
    return { accessToken, refreshToken, expiresIn: config.accessTtlSec };
  }

  const userId = callerId;

  // Pre-login: the client needs its salt to stretch the password. Unknown users get a stable
  // fake salt so the endpoint cannot be used to enumerate accounts.
  app.get(
    '/api/auth/kdf',
    {
      ...authLimit,
      schema: {
        querystring: {
          type: 'object',
          required: ['username'],
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 64 },
          },
        },
      },
    },
    /**
     * GET /api/auth/kdf: the salt and the cost with which the browser derives its keys for a username (a fake one for unknown names, so nobody can tell which exist).
     */
    async function (req) {
      const { username } = req.query as { username: string };
      const row = db
        .prepare('SELECT kdf_salt, kdf_iterations FROM users WHERE username = ?')
        .get(username) as { kdf_salt: string; kdf_iterations: number } | undefined;
      if (row) return { salt: row.kdf_salt, iterations: row.kdf_iterations };
      const fake = createHmac('sha256', config.serverSecret)
        .update('kdf-salt:' + username.toLowerCase())
        .digest()
        .subarray(0, 16);
      return {
        salt: fake.toString('base64'),
        iterations: Math.max(config.minKdfIterations, 600_000),
      };
    },
  );

  app.post(
    '/api/auth/register',
    { ...authLimit, schema: registerSchema },
    /**
     * POST /api/auth/register: creates an account from the public keys and the proof of the password derived in the browser.
     */
    async function (req, reply) {
      const body = req.body as {
        username: string;
        displayName?: string;
        authSecret: string;
        kdfSalt: string;
        kdfIterations: number;
        publicKeys: { ecdh: string; ecdsa: string };
        wrappedKeys: { ecdh: string; ecdsa: string };
      };
      if (body.kdfIterations < config.minKdfIterations) {
        return reply.code(400).send({
          error: 'kdf_too_weak',
          minIterations: config.minKdfIterations,
        });
      }
      if (!isValidP256Point(body.publicKeys.ecdh) || !isValidP256Point(body.publicKeys.ecdsa)) {
        return reply.code(400).send({ error: 'invalid_public_key' });
      }
      if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(body.username)) {
        return reply.code(409).send({ error: 'username_taken' });
      }
      const id = randomUUID();
      const authHash = await hashAuthSecret(body.authSecret, config.scrypt, config.serverSecret);
      const colors = ['#2ef2b0', '#a78bfa', '#fb7185', '#38bdf8', '#fbbf24'];
      try {
        db.prepare(
          `INSERT INTO users (id, username, display_name, auth_hash, kdf_salt, kdf_iterations,
           pub_ecdh, pub_ecdsa, wrapped_ecdh, wrapped_ecdsa, avatar_color, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          id,
          body.username,
          clean(body.displayName ?? body.username) || body.username,
          authHash,
          body.kdfSalt,
          body.kdfIterations,
          body.publicKeys.ecdh,
          body.publicKeys.ecdsa,
          body.wrappedKeys.ecdh,
          body.wrappedKeys.ecdsa,
          colors[randomBytes(1)[0]! % colors.length],
          Date.now(),
        );
      } catch {
        return reply.code(409).send({ error: 'username_taken' });
      }
      const row = getUser(db, id)!;
      return reply.code(201).send({ user: toPublicUser(row), ...issueTokens(id) });
    },
  );

  // A throwaway hash so unknown usernames cost the same CPU time as wrong passwords.
  let dummyHash: Promise<string> | undefined;

  app.post(
    '/api/auth/login',
    {
      ...authLimit,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['username', 'authSecret'],
          properties: {
            username: { type: 'string', minLength: 1, maxLength: 64 },
            authSecret: authSecretField,
          },
        },
      },
    },
    /**
     * POST /api/auth/login: checks the proof of the password (slow hash, locked after several failures) and opens a session.
     */
    async function (req, reply) {
      const { username, authSecret } = req.body as {
        username: string;
        authSecret: string;
      };
      const wait = ctx.throttle.retryAfter(username);
      if (wait > 0) {
        return reply
          .code(429)
          .header('Retry-After', String(wait))
          .send({ error: 'account_locked', retryAfter: wait });
      }
      const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
        UserRow | undefined;
      let ok = false;
      if (row) {
        ok = await verifyAuthSecret(authSecret, row.auth_hash, config.serverSecret);
      } else {
        dummyHash ??= hashAuthSecret('x', config.scrypt, config.serverSecret);
        await verifyAuthSecret(authSecret, await dummyHash, config.serverSecret);
      }
      if (!row || !ok) {
        ctx.throttle.recordFailure(username);
        return reply.code(401).send({ error: 'invalid_credentials' });
      }
      ctx.throttle.recordSuccess(username);
      // A hash made before the pepper existed is made again now that the proof of the password is at hand.
      if (needsUpgrade(row.auth_hash)) {
        db.prepare('UPDATE users SET auth_hash = ? WHERE id = ?').run(
          await hashAuthSecret(authSecret, config.scrypt, config.serverSecret),
          row.id,
        );
      }
      return {
        user: toPublicUser(row),
        wrappedKeys: { ecdh: row.wrapped_ecdh, ecdsa: row.wrapped_ecdsa },
        ...issueTokens(row.id),
      };
    },
  );

  app.post(
    '/api/auth/refresh',
    {
      ...authLimit,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', minLength: 20, maxLength: 128 },
          },
        },
      },
    },
    /**
     * POST /api/auth/refresh: gives a new pair of tokens and cancels the old one (a refresh token works once: reusing it closes every session of the account).
     */
    async function (req, reply) {
      const { refreshToken } = req.body as { refreshToken: string };
      const session = db
        .prepare('SELECT * FROM sessions WHERE token_hash = ?')
        .get(sha256(refreshToken)) as
        { id: string; user_id: string; expires_at: number } | undefined;
      if (!session) {
        // Reusing a token that was already rotated means it was copied: every session of that account is closed.
        const spent = db
          .prepare('SELECT user_id FROM spent_tokens WHERE token_hash = ?')
          .get(sha256(refreshToken)) as { user_id: string } | undefined;
        if (spent) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(spent.user_id);
        return reply.code(401).send({ error: 'invalid_refresh_token' });
      }
      if (session.expires_at < Date.now()) {
        return reply.code(401).send({ error: 'invalid_refresh_token' });
      }
      // Rotation: a refresh token works exactly once.
      db.prepare(
        'INSERT OR IGNORE INTO spent_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
      ).run(sha256(refreshToken), session.user_id, session.expires_at);
      db.prepare('DELETE FROM spent_tokens WHERE expires_at < ?').run(Date.now());
      db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
      return issueTokens(session.user_id);
    },
  );

  app.post(
    '/api/auth/logout',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string', maxLength: 128 } },
        },
      },
    },
    /** POST /api/auth/logout: closes the session of a refresh token. */
    async function (req, reply) {
      const { refreshToken } = req.body as { refreshToken: string };
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(refreshToken));
      return reply.code(204).send();
    },
  );

  // ---- authenticated profile endpoints ------------------------------------------------------

  app.get('/api/me', { onRequest: [app.authenticate] }, async function (req, reply) {
    const row = getUser(db, userId(req));
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return { user: toPublicUser(row) };
  });

  app.patch(
    '/api/me',
    {
      onRequest: [app.authenticate],
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            displayName: { type: 'string', minLength: 1, maxLength: 32 },
            pronouns: { type: 'string', maxLength: 32 },
            bio: { type: 'string', maxLength: 1000 },
            statusText: { type: 'string', maxLength: 80 },
            accent: { type: 'string', enum: [...ACCENTS] },
            aura: { type: 'string', enum: [...AURAS] },
            auraColor: {
              type: 'string',
              pattern: '^(#[0-9a-fA-F]{6},#[0-9a-fA-F]{6})?$',
            },
            nameFont: { type: 'string', enum: [...NAME_FONTS] },
            avatarColor: { type: 'string', pattern: HEX },
            bannerColor: {
              type: 'string',
              pattern:
                '^(#[0-9a-fA-F]{6}|g:#[0-9a-fA-F]{6},#[0-9a-fA-F]{6},[0-9]{1,3},[0-9]{1,3}(,[0-9]{1,3},[0-9]{1,3}(,#[0-9a-fA-F]{6})?)?|m:[0-9]{1,3}:[0-9]{1,3}:#[0-9a-fA-F]{6}@[0-9]{1,3}(,#[0-9a-fA-F]{6}@[0-9]{1,3}){1,4})?$',
            },
            profileColor: {
              type: 'string',
              pattern:
                '^(#[0-9a-fA-F]{6}|g:#[0-9a-fA-F]{6},#[0-9a-fA-F]{6},[0-9]{1,3}(,[0-9]{1,3},[0-9]{1,3}(,#[0-9a-fA-F]{6})?)?|m:[0-9]{1,3}:[0-9]{1,3}:#[0-9a-fA-F]{6}@[0-9]{1,3}(,#[0-9a-fA-F]{6}@[0-9]{1,3}){1,4})?$',
            },
            avatarImage: { type: ['string', 'null'], pattern: UUID },
            bannerImage: { type: ['string', 'null'], pattern: UUID },
          },
        },
      },
    },
    /** PATCH /api/me: changes the profile; only the listed fields are accepted and every one is validated. */
    async function (req, reply) {
      const id = userId(req);
      const body = req.body as Record<string, string | null>;
      const columns: Record<string, string> = {
        displayName: 'display_name',
        pronouns: 'pronouns',
        bio: 'bio',
        statusText: 'status_text',
        accent: 'accent',
        aura: 'aura',
        auraColor: 'aura_color',
        nameFont: 'name_font',
        avatarColor: 'avatar_color',
        bannerColor: 'banner_color',
        profileColor: 'profile_color',
      };
      const sets: string[] = [];
      const values: (string | null)[] = [];
      for (const [key, column] of Object.entries(columns)) {
        const value = body[key];
        if (typeof value === 'string') {
          sets.push(`${column} = ?`);
          // Bio keeps newlines; everything else is single-line.
          values.push(key === 'bio' ? value.replace(/ /g, '') : clean(value));
        }
      }
      const previous = getUser(db, id)!;
      const orphans: (string | null)[] = [];
      for (const [key, column, kind] of [
        ['avatarImage', 'avatar_image', 'avatar'],
        ['bannerImage', 'banner_image', 'banner'],
      ] as const) {
        if (!(key in body)) continue;
        const next = body[key] ?? null;
        if (next !== null && !ownsImage(ctx, next, id, kind))
          return reply.code(400).send({ error: 'invalid_image' });
        sets.push(`${column} = ?`);
        values.push(next);
        const old = previous[column];
        if (old && old !== next) orphans.push(old);
      }
      if (sets.length)
        db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
      orphans.forEach(function (o) {
        return deleteImage(ctx, o);
      });
      const user = toPublicUser(getUser(db, id)!);
      ctx.hub.sendToMany(presenceAudience(db, id), { t: 'user.update', user });
      ctx.hub.sendTo(id, { t: 'user.update', user });
      return { user };
    },
  );

  app.post(
    '/api/me/password',
    {
      onRequest: [app.authenticate],
      ...authLimit,
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['oldAuthSecret', 'newAuthSecret', 'kdfSalt', 'kdfIterations', 'wrappedKeys'],
          properties: {
            oldAuthSecret: authSecretField,
            newAuthSecret: authSecretField,
            kdfSalt: b64Field(16, 64),
            kdfIterations: { type: 'integer', maximum: 5_000_000 },
            wrappedKeys: wrappedKeysSchema,
          },
        },
      },
    },
    /**
     * POST /api/me/password: changes the password: the old proof is checked and the private keys come re-encrypted from the browser.
     */
    async function (req, reply) {
      const id = userId(req);
      const body = req.body as {
        oldAuthSecret: string;
        newAuthSecret: string;
        kdfSalt: string;
        kdfIterations: number;
        wrappedKeys: { ecdh: string; ecdsa: string };
      };
      // A stolen session must not be able to guess the old password: failures lock this action like the sign-in.
      const lockKey = 'password:' + id;
      const wait = ctx.throttle.retryAfter(lockKey);
      if (wait > 0) {
        return reply
          .code(429)
          .header('Retry-After', String(wait))
          .send({ error: 'account_locked', retryAfter: wait });
      }
      const row = getUser(db, id);
      if (
        !row ||
        !(await verifyAuthSecret(body.oldAuthSecret, row.auth_hash, config.serverSecret))
      ) {
        ctx.throttle.recordFailure(lockKey);
        return reply.code(401).send({ error: 'invalid_credentials' });
      }
      ctx.throttle.recordSuccess(lockKey);
      if (body.kdfIterations < config.minKdfIterations) {
        return reply.code(400).send({
          error: 'kdf_too_weak',
          minIterations: config.minKdfIterations,
        });
      }
      const authHash = await hashAuthSecret(body.newAuthSecret, config.scrypt, config.serverSecret);
      db.prepare(
        `UPDATE users SET auth_hash = ?, kdf_salt = ?, kdf_iterations = ?, wrapped_ecdh = ?, wrapped_ecdsa = ?
          WHERE id = ?`,
      ).run(
        authHash,
        body.kdfSalt,
        body.kdfIterations,
        body.wrappedKeys.ecdh,
        body.wrappedKeys.ecdsa,
        id,
      );
      // Every other device must log in again.
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      return issueTokens(id);
    },
  );
}
