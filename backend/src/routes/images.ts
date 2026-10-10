/**
 * src/routes/images.ts
 * Upload and download of profile pictures, banners and group icons, checking the real type of the file.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context';
import { callerId } from '../validation';
import { sanitizeImage } from '../security/image-sanitize';

export const IMAGE_KINDS = ['avatar', 'banner', 'group'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

const MAX_IMAGES_PER_USER = 30;

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

  // ! Profile pictures, banners and group icons are readable by every signed-in user who knows the id (ids are random
  // and only appear in profiles, but they are NOT a secret and the pictures are NOT end-to-end encrypted: the server
  // stores them in clear). The client re-encodes them to a small WebP first and the server strips any metadata that
  // is still there. Private photographs belong in chat attachments, which are encrypted in the browser.
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
      // The type comes from the bytes. The picture is rebuilt without metadata (EXIF, GPS, text chunks) and
      // refused when it is malformed or its dimensions are absurd: the browser is not trusted to have done it.
      const clean = sanitizeImage(body);
      if (!clean) return reply.code(415).send({ error: 'unsupported_image_type' });
      const count = (
        db.prepare('SELECT COUNT(*) AS n FROM images WHERE owner_id = ?').get(owner) as {
          n: number;
        }
      ).n;
      if (count >= MAX_IMAGES_PER_USER) return reply.code(429).send({ error: 'too_many_images' });
      const id = randomUUID();
      fs.mkdirSync(path.dirname(imageFile(ctx, id)), { recursive: true });
      await fs.promises.writeFile(imageFile(ctx, id), clean.data, { mode: 0o600 });
      try {
        db.prepare(
          'INSERT INTO images (id, owner_id, kind, mime, size, created_at) VALUES (?,?,?,?,?,?)',
        ).run(id, owner, kind, clean.mime, clean.data.length, Date.now());
      } catch (error) {
        // * No row, no file: an upload that cannot be recorded must not leave bytes on the disk.
        await fs.promises.rm(imageFile(ctx, id), { force: true });
        throw error;
      }
      return reply.code(201).send({ id });
    },
  );

  app.get('/api/images/:id', auth, async function (req, reply) {
    const row = db
      .prepare('SELECT mime FROM images WHERE id = ?')
      .get((req.params as { id: string }).id) as { mime: string } | undefined;
    if (!row) return reply.code(404).send({ error: 'not_found' });
    try {
      const data = await fs.promises.readFile(imageFile(ctx, (req.params as { id: string }).id));
      return reply
        .header('Content-Type', row.mime)
        .header('Cache-Control', 'private, max-age=31536000, immutable')
        .header('Content-Security-Policy', "default-src 'none'; sandbox")
        .send(data);
    } catch {
      return reply.code(404).send({ error: 'not_found' });
    }
  });
}
