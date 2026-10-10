/**
 * src/routes/images.ts
 * Upload and download of profile pictures, banners and group icons.
 *
 * * Profile pictures and banners are END-TO-END ENCRYPTED: the browser encrypts the picture with a random key, the server
 * stores only ciphertext, and the key is sealed once for each person who may see it (table image_keys) with the pair key
 * of the owner and that person, so the server cannot open it. Group icons stay readable by signed-in users (they have no
 * owner key to share; the server checks and cleans them).
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context';
import { callerId } from '../validation';
import { profileAudience } from '../models';
import { sanitizeImage } from '../security/image-sanitize';

export const IMAGE_KINDS = ['avatar', 'banner', 'group'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

const MAX_IMAGES_PER_USER = 30;
/** An AES-GCM picture is its 12-byte nonce, the bytes and the 16-byte tag. */
const MIN_ENCRYPTED_BYTES = 12 + 16 + 8;
/** Most people one picture can be sealed for in one request. */
const MAX_KEYS_PER_REQUEST = 1000;
const BASE64_PATTERN = '^[A-Za-z0-9+/]+={0,2}$';

export function imageFile(ctx: AppContext, id: string): string {
  return path.join(ctx.config.uploadDir, 'images', id);
}

/** Removes an uploaded image (row + file) when nothing references it any more. */
export function deleteImage(ctx: AppContext, id: string | null | undefined): void {
  if (!id) return;
  ctx.db.prepare('DELETE FROM images WHERE id = ?').run(id);
  fs.rm(imageFile(ctx, id), { force: true }, function () {
    return undefined;
  });
}

/** True when `id` is an image of `kind` uploaded by `ownerId`. */
export function ownsImage(ctx: AppContext, id: string, ownerId: string, kind: ImageKind): boolean {
  return !!ctx.db
    .prepare('SELECT 1 FROM images WHERE id = ? AND owner_id = ? AND kind = ?')
    .get(id, ownerId, kind);
}

export function registerImageRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, config } = ctx;
  const me = callerId;
  const auth = { onRequest: [app.authenticate] };

  // ! Profile pictures and banners arrive as ciphertext (the server cannot look inside, so it only bounds the size);
  // group icons arrive as a picture that is checked and rebuilt without metadata.
  app.post(
    '/api/images',
    {
      ...auth,
      bodyLimit: config.maxImageBytes + 1024,
      config: { rateLimit: { max: 20, timeWindow: 60_000 } },
      schema: {
        querystring: {
          type: 'object',
          required: ['kind'],
          properties: { kind: { type: 'string', enum: [...IMAGE_KINDS] } },
        },
      },
    },
    async function (req, reply) {
      const owner = me(req);
      const { kind } = req.query as { kind: ImageKind };
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length < 16 || body.length > config.maxImageBytes) {
        return reply.code(400).send({ error: 'invalid_image' });
      }
      const encrypted = kind !== 'group';
      let data: Buffer = body;
      let mime = 'application/octet-stream';
      if (encrypted) {
        if (body.length < MIN_ENCRYPTED_BYTES) {
          return reply.code(400).send({ error: 'invalid_image' });
        }
      } else {
        // The type comes from the bytes. The picture is rebuilt without metadata (EXIF, GPS, text chunks) and
        // ! refused when it is malformed or its dimensions are absurd: the browser is not trusted to have done it.
        const clean = sanitizeImage(body);
        if (!clean) return reply.code(415).send({ error: 'unsupported_image_type' });
        data = clean.data;
        mime = clean.mime;
      }
      const count = (
        db.prepare('SELECT COUNT(*) AS n FROM images WHERE owner_id = ?').get(owner) as {
          n: number;
        }
      ).n;
      if (count >= MAX_IMAGES_PER_USER) return reply.code(429).send({ error: 'too_many_images' });
      const id = randomUUID();
      fs.mkdirSync(path.dirname(imageFile(ctx, id)), { recursive: true });
      await fs.promises.writeFile(imageFile(ctx, id), data, { mode: 0o600 });
      try {
        db.prepare(
          'INSERT INTO images (id, owner_id, kind, mime, size, created_at, encrypted) VALUES (?,?,?,?,?,?,?)',
        ).run(id, owner, kind, mime, data.length, Date.now(), encrypted ? 1 : 0);
      } catch (error) {
        // * No row, no file: an upload that cannot be recorded must not leave bytes on the disk.
        await fs.promises.rm(imageFile(ctx, id), { force: true });
        throw error;
      }
      return reply.code(201).send({ id });
    },
  );

  /** Who may see a picture of this person and does not hold its key yet (with their public key, to seal it for them). */
  app.get('/api/images/:id/audience', auth, async function (req, reply) {
    const id = (req.params as { id: string }).id;
    const row = db.prepare('SELECT owner_id FROM images WHERE id = ? AND encrypted = 1').get(id) as
      { owner_id: string } | undefined;
    if (!row || row.owner_id !== me(req)) return reply.code(404).send({ error: 'not_found' });
    const have = new Set(
      (
        db.prepare('SELECT viewer_id FROM image_keys WHERE image_id = ?').all(id) as {
          viewer_id: string;
        }[]
      ).map(function (entry) {
        return entry.viewer_id;
      }),
    );
    const lookup = db.prepare('SELECT pub_ecdh FROM users WHERE id = ? AND deleted_at IS NULL');
    const missing: { id: string; ecdh: string }[] = [];
    for (const viewer of [row.owner_id, ...profileAudience(db, row.owner_id)]) {
      if (have.has(viewer)) continue;
      const user = lookup.get(viewer) as { pub_ecdh: string } | undefined;
      if (user) missing.push({ id: viewer, ecdh: user.pub_ecdh });
    }
    return { missing };
  });

  /** The owner seals the key of a picture for the people who may see it. */
  app.put(
    '/api/images/:id/keys',
    {
      ...auth,
      bodyLimit: 512 * 1024,
      config: { rateLimit: { max: 60, timeWindow: 60_000 } },
      schema: {
        body: {
          type: 'object',
          required: ['keys'],
          additionalProperties: false,
          properties: {
            keys: {
              type: 'array',
              maxItems: MAX_KEYS_PER_REQUEST,
              items: {
                type: 'object',
                required: ['viewerId', 'iv', 'ciphertext'],
                additionalProperties: false,
                properties: {
                  viewerId: { type: 'string', maxLength: 64 },
                  iv: {
                    type: 'string',
                    maxLength: 64,
                    pattern: BASE64_PATTERN,
                  },
                  ciphertext: {
                    type: 'string',
                    maxLength: 512,
                    pattern: BASE64_PATTERN,
                  },
                },
              },
            },
          },
        },
      },
    },
    async function (req, reply) {
      const id = (req.params as { id: string }).id;
      const owner = me(req);
      const row = db
        .prepare('SELECT owner_id FROM images WHERE id = ? AND encrypted = 1')
        .get(id) as { owner_id: string } | undefined;
      if (!row || row.owner_id !== owner) return reply.code(404).send({ error: 'not_found' });
      const allowed = new Set([owner, ...profileAudience(db, owner)]);
      const keys = (
        req.body as {
          keys: { viewerId: string; iv: string; ciphertext: string }[];
        }
      ).keys.filter(function (entry) {
        return allowed.has(entry.viewerId);
      });
      const insert = db.prepare(
        'INSERT OR REPLACE INTO image_keys (image_id, viewer_id, iv, ciphertext) VALUES (?,?,?,?)',
      );
      db.transaction(function store() {
        for (const entry of keys) insert.run(id, entry.viewerId, entry.iv, entry.ciphertext);
      })();
      return { stored: keys.length };
    },
  );

  /**
   * An encrypted picture and the key sealed for the caller, in ONE answer (the page asks for dozens of pictures when it
   * opens, and one request each keeps the rate limit and the waiting low). 404 when there is no key for the caller.
   */
  app.get('/api/images/:id/open', auth, async function (req, reply) {
    const id = (req.params as { id: string }).id;
    const row = db
      .prepare(
        `SELECT k.iv, k.ciphertext, u.pub_ecdh AS owner_ecdh
           FROM image_keys k JOIN images i ON i.id = k.image_id JOIN users u ON u.id = i.owner_id
          WHERE k.image_id = ? AND k.viewer_id = ? AND i.encrypted = 1`,
      )
      .get(id, me(req)) as { iv: string; ciphertext: string; owner_ecdh: string } | undefined;
    if (!row) return reply.code(404).send({ error: 'not_found' });
    try {
      const data = await fs.promises.readFile(imageFile(ctx, id));
      return {
        iv: row.iv,
        ciphertext: row.ciphertext,
        ownerEcdh: row.owner_ecdh,
        data: data.toString('base64'),
      };
    } catch {
      return reply.code(404).send({ error: 'not_found' });
    }
  });

  /** The key of a picture sealed for the caller, and the public key of the owner that opens it. */
  app.get('/api/images/:id/key', auth, async function (req, reply) {
    const id = (req.params as { id: string }).id;
    const row = db
      .prepare(
        `SELECT k.iv, k.ciphertext, u.id AS owner_id, u.pub_ecdh AS owner_ecdh
           FROM image_keys k JOIN images i ON i.id = k.image_id JOIN users u ON u.id = i.owner_id
          WHERE k.image_id = ? AND k.viewer_id = ?`,
      )
      .get(id, me(req)) as
      { iv: string; ciphertext: string; owner_id: string; owner_ecdh: string } | undefined;
    if (!row) return reply.code(404).send({ error: 'not_found' });
    return {
      iv: row.iv,
      ciphertext: row.ciphertext,
      ownerId: row.owner_id,
      ownerEcdh: row.owner_ecdh,
    };
  });

  app.get('/api/images/:id', auth, async function (req, reply) {
    const id = (req.params as { id: string }).id;
    const row = db.prepare('SELECT mime, encrypted FROM images WHERE id = ?').get(id) as
      { mime: string; encrypted: number } | undefined;
    if (!row) return reply.code(404).send({ error: 'not_found' });
    // ! An encrypted picture is handed only to the people it was sealed for: to anyone else it does not exist.
    if (
      row.encrypted &&
      !db.prepare('SELECT 1 FROM image_keys WHERE image_id = ? AND viewer_id = ?').get(id, me(req))
    ) {
      return reply.code(404).send({ error: 'not_found' });
    }
    try {
      const data = await fs.promises.readFile(imageFile(ctx, id));
      return reply
        .header('Content-Type', row.mime)
        .header(
          'Cache-Control',
          row.encrypted ? 'private, max-age=3600' : 'private, max-age=31536000, immutable',
        )
        .header('Content-Security-Policy', "default-src 'none'; sandbox")
        .send(data);
    } catch {
      return reply.code(404).send({ error: 'not_found' });
    }
  });
}
