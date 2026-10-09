/**
 * src/app/app.config.ts
 * Global Angular configuration: the routes (with delayed preloading) and the restoration of the previous
 * session before the first page is drawn.
 */
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { DelayedPreloadStrategy } from './core/delayed-preload';
import { I18nService } from './core/i18n/i18n.service';
import { AuthService } from './core/services/auth.service';

/** Restores the previous session (tokens and non-extractable keys) before the first route is drawn. */
function restoreSession() {
  return inject(AuthService).init();
}

/** Waits for the dictionary of the language in use, so the first page is not drawn in English first. */
function loadLanguage() {
  return inject(I18nService).ready();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The screens download in the background after the first page is ready, so opening them is instant.
    provideRouter(
      routes,
      withPreloading(DelayedPreloadStrategy),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideAppInitializer(restoreSession),
    provideAppInitializer(loadLanguage),
  ],
};
