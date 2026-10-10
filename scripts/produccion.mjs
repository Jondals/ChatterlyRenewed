/**
 * scripts/produccion.mjs
 * Starts the already built app: the backend (port 3000 by default) and a small static web server (port 4200).
 * It is much faster than `pnpm dev` because `ng serve` serves unoptimized code.
 *
 *   pnpm app        (builds and starts)
 *   pnpm start      (starts what is already built)
 *
 * The static server (scripts/static-server.mjs) returns index.html for the routes of the app, compresses text files
 * with Brotli or gzip (compressed once and kept in memory), caches hashed files forever and adds the usual security
 * headers.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createStaticHandler } from './static-server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BACKEND_DIR = path.join(ROOT, 'backend');
const WEB_DIR = path.join(ROOT, 'frontend', 'dist', 'frontend', 'browser');
const WEB_PORT = Number(process.env.WEB_PORT ?? 4200);

if (!fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
  console.error('The web app is not built: run "pnpm build" (or use "pnpm app").');
  process.exit(1);
}

const backend = spawn(process.execPath, ['--env-file-if-exists=.env', 'dist/index.js'], {
  cwd: BACKEND_DIR,
  stdio: 'inherit',
});

const handleRequest = createStaticHandler(WEB_DIR);

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
