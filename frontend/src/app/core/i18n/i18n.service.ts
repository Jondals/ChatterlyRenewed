/**
 * src/app/core/i18n/i18n.service.ts
 * Language service: detects the browser language, translates texts and provides the `t` pipe.
 */
import { Injectable, Pipe, PipeTransform, computed, effect, inject, signal } from '@angular/core';
import { SettingsService } from '../services/settings.service';

export type Lang = 'en' | 'es';

export const LANGUAGES: { id: Lang; name: string; native: string; flag: string }[] = [
  { id: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { id: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
];

/**
 * Tiny gettext-style translator: the English text IS the key, so a missing translation simply shows
 * English. Placeholders use `{name}`. To add a language, add a dictionary file and an entry above.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsService);
  /** The Spanish dictionary, loaded on demand so English visitors never download it. */
  private readonly spanish = signal<Record<string, string> | null>(null);
  private loading: Promise<void> | null = null;

  constructor() {
    effect(this.loadWhenNeeded.bind(this));
  }

  /** Resolves once the dictionary of the current language is available (used before the first render). */
  ready(): Promise<void> {
    return this.lang() === 'es' ? this.loadSpanish() : Promise.resolve();
  }

  /** Starts loading Spanish as soon as it is the language in use. */
  private loadWhenNeeded(): void {
    if (this.lang() === 'es') {
      void this.loadSpanish();
    }
  }

  /** Downloads the Spanish dictionary once. */
  private loadSpanish(): Promise<void> {
    this.loading ??= import('./es').then(this.storeSpanish.bind(this));
    return this.loading;
  }

  /** Keeps the downloaded dictionary, which makes every `t` pipe redraw. */
  private storeSpanish(module: { ES: Record<string, string> }): void {
    this.spanish.set(module.ES);
  }

  readonly lang = computed<Lang>(
    function (this: I18nService) {
      const pref = this.settings.language();
      if (pref !== 'auto') return pref;
      const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
      return LANGUAGES.some(function (l) {
        return l.id === browser;
      })
        ? (browser as Lang)
        : 'en';
    }.bind(this),
  );
  /** BCP-47 tag for Intl formatting. */
  readonly locale = computed(
    function (this: I18nService) {
      return this.lang() === 'es' ? 'es-ES' : 'en-US';
    }.bind(this),
  );

  /** Translates a text (the English text is the key) and fills in its {placeholders}. */
  t(key: string, params?: Record<string, string | number>): string {
    let text = (this.lang() === 'es' ? this.spanish()?.[key] : undefined) ?? key;
    if (params)
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }
}

/** `{{ 'Add friend' | t }}` / `{{ '{n} members' | t: { n: 3 } }}` — re-evaluates when the language changes. */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  /** Translates the text of a template expression; empty text for no value. */
  transform(key: string | null | undefined, params?: Record<string, string | number>): string {
    return key ? this.i18n.t(key, params) : '';
  }
}
