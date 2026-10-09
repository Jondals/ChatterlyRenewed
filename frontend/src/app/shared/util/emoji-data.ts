/**
 * src/app/shared/util/emoji-data.ts
 * The emoji list (names, tags, skin tones) in one language. It is a big file, so it is downloaded once, kept for the
 * rest of the session and can be asked for in advance while the browser is idle, which makes the picker open at once.
 */

/** One emoji of the list. */
export interface EmojiEntry {
  unicode: string;
  label: string;
  tags?: string[];
  group?: number;
  skins?: { unicode: string }[];
}

/** The lists already asked for, by language. */
const lists = new Map<string, Promise<EmojiEntry[]>>();

/** Downloads one list (never the "components" group, which holds only skin tone and hair modifiers). */
async function download(lang: string): Promise<EmojiEntry[]> {
  const module =
    lang === 'es'
      ? await import('emojibase-data/es/compact.json')
      : await import('emojibase-data/en/compact.json');
  const data = ((module as { default?: unknown }).default ?? module) as EmojiEntry[];
  return data.filter(function keep(entry: EmojiEntry): boolean {
    return entry.group !== undefined && entry.group !== 2;
  });
}

/** The emoji of a language (the same promise for every caller; a failed download can be asked for again). */
export function loadEmojiData(lang: string): Promise<EmojiEntry[]> {
  const key = lang === 'es' ? 'es' : 'en';
  let pending = lists.get(key);
  if (!pending) {
    pending = download(key);
    pending.catch(function forget(): void {
      lists.delete(key);
    });
    lists.set(key, pending);
  }
  return pending;
}

/** Asks for the list when the browser has nothing better to do, so the picker finds it ready. */
export function preloadEmojiData(lang: string): void {
  const ask = function ask(): void {
    void loadEmojiData(lang).catch(function ignore(): void {
      return undefined;
    });
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(ask, { timeout: 4000 });
  } else {
    setTimeout(ask, 2000);
  }
}
