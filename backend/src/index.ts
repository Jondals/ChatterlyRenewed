/**
 * src/index.ts
 * Entry point of the backend: starts the server and shuts it down cleanly when it receives a signal.
 */
import { buildApp } from './app';
import { loadConfig } from './config';

/** Starts the server and closes it cleanly when the process is told to stop. */
async function main() {
  const config = loadConfig();
  const app = await buildApp(config);
  const shutdown = async function () {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      `Chatterly-Renewed backend v${config.version} ready (${config.tls ? 'https' : 'http'}://localhost:${config.port})`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
