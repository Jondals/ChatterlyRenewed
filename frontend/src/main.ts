/**
 * src/main.ts
 * Entry point of the frontend: starts the Angular application.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { startFlagSupport } from './app/core/flag-support';

/** Reports a failure to start the application in the console. */
function reportStartError(error: unknown): void {
  console.error(error);
}

/** Starts the application. */
function start(): void {
  bootstrapApplication(AppComponent, appConfig).catch(reportStartError);
}

startFlagSupport();
if (document.querySelector('app-root[data-snapshot]')) {
  // The picture of the sign-in page that came inside the HTML is painted first, and only then does the app start (and replace it).
  requestAnimationFrame(setTimeout.bind(window, start, 0));
} else {
  start();
}
