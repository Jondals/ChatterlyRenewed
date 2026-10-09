/**
 * src/app.ts
 * Builds the Fastify server: security headers, CORS, request limits, JWT, the database and the registration of every route and of the WebSocket.
 */
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import fs from 'node:fs';
import { loadConfig, type AppConfig } from './config';
import { openDatabase } from './db';
import { Hub } from './ws/hub';
import { LoginThrottle } from './security/throttle';
import type { AppContext } from './context';
import { registerAuthRoutes } from './routes/auth';
import { registerSocialRoutes } from './routes/social';
import { registerGuildRoutes } from './routes/guilds';
import { registerMessageRoutes } from './routes/messages';
import { registerImageRoutes } from './routes/images';
import { registerGifRoutes } from './routes/gifs';
import { registerPreviewRoutes } from './routes/preview';
import { registerSocket } from './ws/socket';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    ctx: AppContext;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

/**
 * Builds the whole server: security headers, CORS, limits, tokens, database and every route. The tests build it too.
 */
export async function buildApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({
    logger: config.logger ? { redact: ['req.headers.authorization'] } : false,
    bodyLimit: 256 * 1024,
    trustProxy: process.env['TRUST_PROXY'] === '1',
    ...(config.tls
      ? {
          https: {
            key: fs.readFileSync(config.tls.key),
            cert: fs.readFileSync(config.tls.cert),
          },
        }
      : {}),
  });

  // This service only speaks JSON: lock down everything a browser could be tricked into doing.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  // API answers are never stored in shared caches or in the browser (except media, which has its own policy).
  app.addHook('onSend', async function (_req, reply, payload) {
    if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store');
    reply.header(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    );
    return payload;
  });
  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });
  await app.register(rateLimit, {
    global: true,
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
  });
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  const db = openDatabase(config.dbPath);
  app.decorate('authenticate', async function (req: FastifyRequest, reply: FastifyReply) {
    try {
      await req.jwtVerify();
      const who = (req.user as { sub: string }).sub;
      if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(who)) throw new Error('gone');
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
    }
  });

  const hub = new Hub(db);
  const throttle = new LoginThrottle(config.loginLockout);
  const ctx: AppContext = { db, config, hub, throttle };
  app.decorate('ctx', ctx);

  app.setErrorHandler(function (
    error: {
      statusCode?: number;
      validation?: unknown;
      code?: string;
      message: string;
    },
    req,
    reply,
  ) {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      req.log.error(error);
      return reply.code(500).send({ error: 'internal_error' });
    }
    return reply.code(status).send({
      error: error.validation ? 'validation_error' : (error.code ?? 'bad_request').toLowerCase(),
      message: error.validation ? error.message : undefined,
    });
  });

  app.get('/api/health', async function () {
    return {
      status: 'ok',
      version: config.version,
      connections: hub.connectionCount(),
    };
  });

  registerAuthRoutes(app, ctx);
  registerSocialRoutes(app, ctx);
  registerGuildRoutes(app, ctx);
  registerMessageRoutes(app, ctx);
  registerImageRoutes(app, ctx);
  registerGifRoutes(app, ctx);
  registerPreviewRoutes(app, ctx);
  registerSocket(app, ctx);

  app.addHook('onClose', async function () {
    hub.shutdown();
    db.close();
  });

  return app;
}
