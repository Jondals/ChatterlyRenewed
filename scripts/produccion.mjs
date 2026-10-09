/**
 * scripts/produccion.mjs
 * Starts the already built app: the backend (port 3000 by default) and a small static web server (port 4200).
 * It is much faster than `pnpm dev` because `ng serve` serves unoptimized code.
 *
 *   pnpm app        (builds and starts)
 *   pnpm start      (starts what is already built)
 *
 * The static server returns index.html for the routes of the app, compresses text files with Brotli or gzip
 * (compressed once and kept in memory), caches hashed files forever and adds the usual security headers.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const BACKEND_DIR = path.join(ROOT, 'backend');
const WEB_DIR = path.join(ROOT, 'frontend', 'dist', 'frontend', 'browser');
const WEB_PORT = Number(process.env.WEB_PORT ?? 4200);

/** Content type of each file extension the build produces. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/** Extensions worth compressing (the rest is already compressed). */
const COMPRESSIBLE = ['.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt', '.ico'];

/** Headers added to every response. */
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(self), microphone=(self), geolocation=(), payment=()',
};

if (!fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
  console.error('The web app is not built: run "pnpm build" (or use "pnpm app").');
  process.exit(1);
}

const backend = spawn(process.execPath, ['--env-file-if-exists=.env', 'dist/index.js'], {
  cwd: BACKEND_DIR,
  stdio: 'inherit',
});

/** Compressed copies of the files, made the first time each one is asked for. */
const compressedCache = new Map();

/**
 * Returns the file as it should be sent: compressed when the browser accepts it and the file is text.
 * @param {string} file Absolute path of the file.
 * @param {string} acceptEncoding Value of the Accept-Encoding header.
 * @returns {{ body: Buffer, encoding: string | null }}
 */
function readForClient(file, acceptEncoding) {
  const extension = path.extname(file);
  const wantsBrotli = /\bbr\b/.test(acceptEncoding);
  const wantsGzip = /\bgzip\b/.test(acceptEncoding);
  if (!COMPRESSIBLE.includes(extension) || (!wantsBrotli && !wantsGzip)) {
    return { body: fs.readFileSync(file), encoding: null };
  }
  const encoding = wantsBrotli ? 'br' : 'gzip';
  const key = file + '|' + encoding;
  let body = compressedCache.get(key);
  if (!body) {
    const raw = fs.readFileSync(file);
    body =
      encoding === 'br'
        ? zlib.brotliCompressSync(raw, {
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
          })
        : zlib.gzipSync(raw, { level: 9 });
    compressedCache.set(key, body);
  }
  return { body, encoding };
}

/**
 * Answers one request: the file if it exists, otherwise index.html so the app can handle the route.
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
function handleRequest(request, response) {
  const route = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  let file = path.join(WEB_DIR, route);
  if (!file.startsWith(WEB_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(WEB_DIR, 'index.html');
  }
  const hashed = /-[A-Za-z0-9]{8}\.(js|css|woff2?)$/.test(file);
  const { body, encoding } = readForClient(file, String(request.headers['accept-encoding'] ?? ''));
  const headers = {
    ...SECURITY_HEADERS,
    'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    vary: 'Accept-Encoding',
  };
  if (encoding) headers['content-encoding'] = encoding;
  response.writeHead(200, headers);
  response.end(body);
}

const server = http.createServer(handleRequest);
server.listen(WEB_PORT, function onListening() {
  console.log(`Chatterly-Renewed ready at http://localhost:${WEB_PORT}`);
});

/** Stops both servers and exits. */
function shutdown() {
  server.close();
  backend.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
backend.on('exit', function onBackendExit(code) {
  server.close();
  process.exit(code ?? 0);
});
