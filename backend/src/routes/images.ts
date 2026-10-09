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

export const IMAGE_KINDS = ['avatar', 'banner', 'group'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

const MAX_IMAGES_PER_USER = 30;

/** Identify an image by its magic bytes — never trust the client's declared type. SVG is refused on purpose. */
export function sniffImage(buf: Buffer): string | null {
  if (
    buf.length > 12 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 6 && buf.subarray(0, 4).toString('latin1') === 'GIF8') return 'image/gif';
  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

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

  // Profile pictures, banners and group icons are public to signed-in users (the client re-encodes
  // them to a small WebP first); they are not part of the end-to-end encrypted payload.
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
      const mime = sniffImage(body);
      if (!mime) return reply.code(415).send({ error: 'unsupported_image_type' });
      const count = (
        db.prepare('SELECT COUNT(*) AS n FROM images WHERE owner_id = ?').get(owner) as {
          n: number;
        }
      ).n;
      if (count >= MAX_IMAGES_PER_USER) return reply.code(429).send({ error: 'too_many_images' });
      const id = randomUUID();
      fs.mkdirSync(path.dirname(imageFile(ctx, id)), { recursive: true });
      await fs.promises.writeFile(imageFile(ctx, id), body, { mode: 0o600 });
      db.prepare(
        'INSERT INTO images (id, owner_id, kind, mime, size, created_at) VALUES (?,?,?,?,?,?)',
      ).run(id, owner, kind, mime, body.length, Date.now());
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
