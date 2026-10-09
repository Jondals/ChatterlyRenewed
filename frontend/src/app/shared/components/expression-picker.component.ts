/**
 * src/app/shared/components/expression-picker.component.ts
 * Selector de emojis, GIFs y stickers.
 */
import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { GifService, type GifResult } from '../../core/services/gif.service';
import { SettingsService } from '../../core/services/settings.service';
import { StickerStore, type Sticker, type StickerPack } from '../../core/services/sticker.store';
import { ToastService } from '../../core/services/toast.service';
import { loadEmojiData, type EmojiEntry } from '../util/emoji-data';
import { IconComponent } from './icon.component';

type Tab = 'emoji' | 'gif' | 'sticker';

const GROUP_ICONS = ['😀', '👋', '', '🐻', '🍔', '✈️', '⚽', '💡', '🔣', '🏳️'];
const GROUP_NAMES = [
  'Smileys & emotion',
  'People & body',
  '',
  'Animals & nature',
  'Food & drink',
  'Travel & places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
];
const SKIN_SWATCHES = ['#ffcc4d', '#f7dece', '#e0bb95', '#bf8f68', '#9b643d', '#594539'];
const FREQ_KEY = 'chatterly.emojiFreq';

@Component({
  selector: 'app-gif-thumb',
  standalone: true,
  template: `
    <button
      type="button"
      class="group relative mb-2 block w-full overflow-hidden rounded-ui bg-white/5"
      [style.aspect-ratio]="gif().width + '/' + gif().height"
      (click)="chosen.emit(gif())"
      [attr.aria-label]="gif().title"
    >
      @if (src(); as url) {
        <img
          [src]="url"
          [alt]="gif().title"
          loading="lazy"
          class="anim-fade-in h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      } @else {
        <div class="shimmer h-full w-full"></div>
      }
    </button>
  `,
})
export class GifThumbComponent {
  readonly gif = input.required<GifResult>();
  readonly chosen = output<GifResult>();
  private readonly service = inject(GifService);
  protected readonly src = signal<string | null>(null);

  constructor() {
    effect(
      function (this: GifThumbComponent) {
        const url = this.gif().preview;
        untracked(
          function (this: GifThumbComponent) {
            return void this.service.preview(url).then(
              function (this: GifThumbComponent, u: string) {
                return this.src.set(u);
              }.bind(this),
              function () {
                return undefined;
              },
            );
          }.bind(this),
        );
      }.bind(this),
    );
  }
}

/**
 * One panel for everything expressive: our own emoji picker (searchable in your language, skin tones,
 * frequently used), GIFs from GIPHY via the backend proxy, and your sticker packs (WhatsApp import).
 */
@Component({
  selector: 'app-expression-picker',
  standalone: true,
  imports: [IconComponent, GifThumbComponent, TranslatePipe],
  template: `
    <div
      class="anim-pop flex h-[30rem] w-[27rem] max-md:h-[min(30rem,60dvh)] max-md:w-full rounded-ui-lg border border-white/10 bg-ink-800 shadow-2xl max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden"
      (mousedown)="$event.stopPropagation()"
    >
      <div class="flex items-center gap-1 border-b border-white/6 p-2">
        @for (t of tabs(); track t) {
          <button
            type="button"
            class="btn btn-sm flex-1"
            [class.btn-active]="tab() === t"
            [class.btn-ghost]="tab() !== t"
            (click)="setTab(t)"
          >
            <app-icon
              [name]="t === 'emoji' ? 'smile' : t === 'gif' ? 'gif' : 'sticker'"
              [size]="15"
            />
            {{ (t === 'emoji' ? 'Emoji' : t === 'gif' ? 'GIFs' : 'Stickers') | t }}
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('emoji') {
          <div class="flex items-center gap-2 px-3 pt-3">
            <div
              class="flex h-9 flex-1 items-center gap-2 rounded-ui bg-black/30 px-3 text-sm focus-within:ring-1 focus-within:ring-accent/60"
            >
              <app-icon name="search" [size]="14" class="text-dim" />
              <input
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim"
                [placeholder]="'Search emoji' | t"
                [value]="query()"
                (input)="query.set($any($event.target).value)"
              />
            </div>
            <div class="relative">
              <button
                type="button"
                class="btn btn-icon btn-sm"
                (click)="toneOpen.set(!toneOpen())"
                [attr.aria-label]="'Skin tone' | t"
              >
                <span
                  class="h-4 w-4 rounded-full"
                  [style.background]="swatches[settings.skinTone()]"
                ></span>
              </button>
              @if (toneOpen()) {
                <div class="panel anim-pop absolute right-0 top-10 z-10 flex gap-1 p-1.5">
                  @for (c of swatches; track $index) {
                    <button
                      type="button"
                      class="h-6 w-6 rounded-full ring-offset-2 ring-offset-ink-850 hover:scale-110"
                      [class.ring-2]="settings.skinTone() === $index"
                      [class.ring-accent]="settings.skinTone() === $index"
                      [style.background]="c"
                      (click)="settings.skinTone.set($index); toneOpen.set(false)"
                    ></button>
                  }
                </div>
              }
            </div>
          </div>
          <div class="flex gap-0.5 overflow-x-auto px-2 pt-2">
            @for (g of groupTabs(); track g.id) {
              <button
                type="button"
                class="rounded-ui px-2 py-1 text-xl hover:bg-white/10"
                [class.bg-white/10]="activeGroup() === g.id"
                (click)="jump(g.id)"
                [attr.title]="g.name | t"
              >
                {{ g.icon }}
              </button>
            }
          </div>
          <div
            #scroller
            class="min-h-0 flex-1 overflow-y-auto px-3 pb-2"
            (scroll)="onScroll($event)"
          >
            @if (loading()) {
              <div class="grid grid-cols-7 gap-1 pt-2">
                @for (i of skeleton; track i) {
                  <div class="shimmer aspect-square rounded-ui"></div>
                }
              </div>
            }
            @for (section of visibleSections(); track section.id) {
              <div
                class="label sticky top-0 z-[1] -mx-3 bg-ink-800 px-3 py-1.5"
                [attr.data-group]="section.id"
              >
                {{ section.name | t }}
              </div>
              <div
                class="emoji-grid grid grid-cols-7 gap-0.5"
                style="content-visibility: auto; contain-intrinsic-size: auto 240px"
              >
                @for (e of section.items; track e.unicode) {
                  <button
                    type="button"
                    class="emoji-cell flex aspect-square items-center justify-center rounded-ui leading-none"
                    (mouseenter)="hover.set(e)"
                    (click)="pickEmoji(e)"
                  >
                    <span class="emoji-glyph">{{ show(e) }}</span>
                  </button>
                }
              </div>
            } @empty {
              @if (!loading()) {
                <p class="py-10 text-center text-sm text-muted">{{ 'No emoji found' | t }}</p>
              }
            }
          </div>
          <div class="flex h-10 items-center gap-2 border-t border-white/6 px-3 text-sm text-muted">
            @if (hover(); as h) {
              <span class="text-xl">{{ show(h) }}</span
              ><span class="truncate">{{ h.label }}</span>
            } @else {
              <span>{{ 'Pick an emoji' | t }}</span>
            }
          </div>
        }

        @case ('gif') {
          <div class="px-3 pb-2 pt-3">
            <div
              class="flex h-9 items-center gap-2 rounded-ui bg-black/30 px-3 text-sm focus-within:ring-1 focus-within:ring-accent/60"
            >
              <app-icon name="search" [size]="14" class="text-dim" />
              <input
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim"
                [placeholder]="'Search GIPHY' | t"
                [value]="gifQuery()"
                (input)="onGifQuery($any($event.target).value)"
              />
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
            @if (gifs.enabled() === false) {
              <div
                class="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted"
              >
                <app-icon name="gif" [size]="34" class="text-dim" />
                <b class="text-fg">{{ 'GIF search is not enabled on this server' | t }}</b>
                <span>{{
                  'The server admin needs to set GIPHY_API_KEY (free at developers.giphy.com).' | t
                }}</span>
              </div>
            } @else {
              <div class="columns-2 gap-2">
                @for (g of gifResults(); track g.id) {
                  <app-gif-thumb [gif]="g" (chosen)="pickGif($event)" />
                }
              </div>
              @if (gifLoading()) {
                <div class="shimmer mt-1 h-20 rounded-ui"></div>
              }
              @if (gifNext() && !gifLoading()) {
                <button type="button" class="btn btn-sm mt-1 w-full" (click)="loadGifs(true)">
                  {{ 'Load more' | t }}
                </button>
              }
              @if (gifError()) {
                <p class="mt-2 text-center text-sm text-red-300">{{ gifError() | t }}</p>
              }
              <p class="mt-3 text-center text-[10px] text-dim">
                {{
                  'GIFs are fetched through the server and re-encrypted before sending. Powered by GIPHY.'
                    | t
                }}
              </p>
            }
          </div>
        }

        @case ('sticker') {
          <div class="flex items-center gap-1 overflow-x-auto px-2 pt-2">
            @for (p of stickers.packs(); track p.id) {
              <button
                type="button"
                class="relative h-9 w-9 shrink-0 overflow-hidden rounded-ui p-0.5 hover:bg-white/10"
                [class.bg-white/10]="activePack()?.id === p.id"
                (click)="activePackId.set(p.id)"
                [attr.title]="p.name"
              >
                <img
                  [src]="stickers.url(p.items[0]!)"
                  alt=""
                  class="h-full w-full object-contain"
                />
              </button>
            }
            <button
              type="button"
              class="btn btn-icon btn-sm shrink-0"
              (click)="importStickers()"
              [attr.aria-label]="'Import stickers' | t"
            >
              <app-icon name="plus" [size]="16" />
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-3">
            @if (activePack(); as pack) {
              <div class="mb-2 flex items-center justify-between">
                <span class="label truncate">{{ pack.name }}</span>
                <button
                  type="button"
                  class="text-xs text-muted hover:text-red-300"
                  (click)="deletePack(pack)"
                >
                  {{ 'Delete pack' | t }}
                </button>
              </div>
              <div class="grid grid-cols-4 gap-2">
                @for (s of pack.items; track s.id) {
                  <button
                    type="button"
                    class="group relative aspect-square rounded-ui p-1 hover:bg-white/10"
                    (click)="pickSticker(s)"
                    (contextmenu)="removeSticker($event, pack, s)"
                  >
                    <img
                      [src]="stickers.url(s)"
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-contain transition duration-300 group-hover:scale-110"
                    />
                  </button>
                }
              </div>
              <p class="mt-3 text-center text-[11px] text-dim">
                {{ 'Right-click a sticker to remove it.' | t }}
              </p>
            } @else {
              <div
                class="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted"
              >
                <app-icon name="sticker" [size]="34" class="text-dim" />
                <b class="text-fg">{{ 'No stickers yet' | t }}</b>
                <span>{{
                  'Import your WhatsApp stickers (.wastickers or .webp files) or start with an emoji pack.'
                    | t
                }}</span>
                <div class="flex gap-2">
                  <button type="button" class="btn btn-primary btn-sm" (click)="importStickers()">
                    <app-icon name="upload" [size]="14" /> {{ 'Import' | t }}
                  </button>
                  <button type="button" class="btn btn-sm" (click)="starter()">
                    {{ 'Starter pack' | t }}
                  </button>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ExpressionPickerComponent {
  readonly tabs = input<Tab[]>(['emoji', 'gif', 'sticker']);
  readonly emoji = output<string>();
  readonly gif = output<GifResult>();
  readonly sticker = output<Sticker>();
  readonly closed = output<void>();

  protected readonly settings = inject(SettingsService);
  protected readonly gifs = inject(GifService);
  protected readonly stickers = inject(StickerStore);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<Tab>((sessionStorage.getItem('picker.tab') as Tab) || 'emoji');
  protected readonly swatches = SKIN_SWATCHES;
  protected readonly skeleton = Array.from({ length: 40 }, function (_, i) {
    return i;
  });

  // emoji
  private readonly all = signal<EmojiEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly query = signal('');
  protected readonly hover = signal<EmojiEntry | null>(null);
  protected readonly toneOpen = signal(false);
  protected readonly activeGroup = signal<number | 'frequent'>('frequent');
  private readonly freq = signal<Record<string, number>>(this.readFreq());

  protected readonly sections = computed(
    function (this: ExpressionPickerComponent) {
      const q = this.query().trim().toLowerCase();
      const all = this.all();
      if (q) {
        const hits = all
          .filter(function (e) {
            return (
              e.label.toLowerCase().includes(q) ||
              e.tags?.some(function (t) {
                return t.toLowerCase().startsWith(q);
              })
            );
          })
          .slice(0, 160);
        return hits.length ? [{ id: -1, name: 'Results', items: hits }] : [];
      }
      const out: { id: number | string; name: string; items: EmojiEntry[] }[] = [];
      const freq = this.freq();
      const frequent = Object.entries(freq)
        .sort(function (a, b) {
          return b[1] - a[1];
        })
        .slice(0, 24)
        .map(function ([u]) {
          return all.find(function (e) {
            return e.unicode === u;
          });
        })
        .filter(function (e): e is EmojiEntry {
          return !!e;
        });
      if (frequent.length) out.push({ id: 'frequent', name: 'Frequently used', items: frequent });
      for (let g = 0; g < GROUP_NAMES.length; g++) {
        if (g === 2) continue;
        const items = all.filter(function (e) {
          return e.group === g;
        });
        if (items.length) out.push({ id: g, name: GROUP_NAMES[g]!, items });
      }
      return out;
    }.bind(this),
  );
  /** How many sections are drawn. The first ones appear at once and the rest follow one by one, so opening never freezes. */
  private readonly drawn = signal(2);
  protected readonly visibleSections = computed(
    function (this: ExpressionPickerComponent) {
      return this.sections().slice(0, this.drawn());
    }.bind(this),
  );
  protected readonly groupTabs = computed(
    function (this: ExpressionPickerComponent) {
      const tabs = this.sections()
        .filter(function (s) {
          return s.id !== -1;
        })
        .map(function (s) {
          return {
            id: s.id as number | 'frequent',
            icon: s.id === 'frequent' ? '🕘' : GROUP_ICONS[s.id as number]!,
            name: s.name,
          };
        });
      return this.query() ? [] : tabs;
    }.bind(this),
  );

  // gifs
  protected readonly gifQuery = signal('');
  protected readonly gifResults = signal<GifResult[]>([]);
  protected readonly gifNext = signal('');
  protected readonly gifLoading = signal(false);
  protected readonly gifError = signal('');
  private gifTimer: ReturnType<typeof setTimeout> | undefined;

  // stickers
  protected readonly activePackId = signal<string | null>(null);
  protected readonly activePack = computed<StickerPack | undefined>(
    function (this: ExpressionPickerComponent) {
      const packs = this.stickers.packs();
      return (
        packs.find(
          function (this: ExpressionPickerComponent, p: StickerPack) {
            return p.id === this.activePackId();
          }.bind(this),
        ) ?? packs[0]
      );
    }.bind(this),
  );

  constructor() {
    void this.loadEmoji();
    // Draw the remaining sections one at a time while the browser has time.
    effect(
      function (this: ExpressionPickerComponent) {
        const total = this.sections().length;
        const drawn = this.drawn();
        if (drawn < total) {
          untracked(
            function (this: ExpressionPickerComponent) {
              setTimeout(this.drawMore.bind(this), 40);
            }.bind(this),
          );
        }
      }.bind(this),
    );
    effect(
      function (this: ExpressionPickerComponent) {
        const tab = this.tab();
        untracked(
          function (this: ExpressionPickerComponent) {
            sessionStorage.setItem('picker.tab', tab);
            if (tab === 'gif')
              void this.gifs.init().then(
                function (this: ExpressionPickerComponent) {
                  if (!this.gifResults().length && this.gifs.enabled()) void this.loadGifs(false);
                }.bind(this),
              );
            if (tab === 'sticker') void this.stickers.load();
          }.bind(this),
        );
      }.bind(this),
    );
    // Changing language reloads the emoji names so search works in that language.
    effect(
      function (this: ExpressionPickerComponent) {
        this.i18n.lang();
        untracked(
          function (this: ExpressionPickerComponent) {
            return void this.loadEmoji();
          }.bind(this),
        );
      }.bind(this),
    );
  }

  /** Changes between emoji, GIFs and stickers. */
  protected setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  // ---- emoji
  private async loadEmoji(): Promise<void> {
    this.loading.set(true);
    try {
      this.all.set(await loadEmojiData(this.i18n.lang()));
    } finally {
      this.loading.set(false);
    }
  }

  /** The emoji with the skin tone the person chose. */
  protected show(e: EmojiEntry): string {
    const tone = this.settings.skinTone();
    return tone > 0 && e.skins?.[tone - 1] ? e.skins[tone - 1]!.unicode : e.unicode;
  }

  /** Picks an emoji: it is sent to the box and counted so the most used ones come first. */
  protected pickEmoji(e: EmojiEntry): void {
    const emoji = this.show(e);
    const next = { ...this.freq(), [e.unicode]: (this.freq()[e.unicode] ?? 0) + 1 };
    this.freq.set(next);
    try {
      localStorage.setItem(FREQ_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    this.emoji.emit(emoji);
  }

  /** The counts of the emoji used, kept on this device. */
  private readFreq(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(FREQ_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  /** Draws one more section. */
  private drawMore(): void {
    this.drawn.update(function (n: number): number {
      return n + 1;
    });
  }

  /** Jumps to a group of emoji; every section is drawn first so the jump finds it. */
  protected jump(id: number | string): void {
    this.activeGroup.set(id as number);
    this.drawn.set(1000);
    requestAnimationFrame(function scroll(): void {
      document
        .querySelector(`[data-group="${id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /** Follows the scroll to mark the group of emoji that is in view. */
  protected onScroll(event: Event): void {
    const container = event.target as HTMLElement;
    const headers = Array.from(container.querySelectorAll<HTMLElement>('[data-group]'));
    const top = container.getBoundingClientRect().top + 12;
    const current =
      headers
        .filter(function (h) {
          return h.getBoundingClientRect().top <= top;
        })
        .pop() ?? headers[0];
    const id = current?.dataset['group'];
    if (id) this.activeGroup.set(id === 'frequent' ? 'frequent' : Number(id));
  }

  // ---- gifs
  protected onGifQuery(value: string): void {
    this.gifQuery.set(value);
    clearTimeout(this.gifTimer);
    this.gifTimer = setTimeout(
      function (this: ExpressionPickerComponent) {
        return void this.loadGifs(false);
      }.bind(this),
      350,
    );
  }

  /** Loads GIFs (a search or the trending ones), more of them when the end is reached. */
  protected async loadGifs(more: boolean): Promise<void> {
    if (!this.gifs.enabled()) return;
    this.gifLoading.set(true);
    this.gifError.set('');
    try {
      const q = this.gifQuery().trim();
      const pos = more ? this.gifNext() : '';
      const page = q ? await this.gifs.search(q, pos) : await this.gifs.featured(pos);
      this.gifResults.set(more ? [...this.gifResults(), ...page.results] : page.results);
      this.gifNext.set(page.next);
    } catch {
      this.gifError.set('Could not load GIFs. Try again.');
    } finally {
      this.gifLoading.set(false);
    }
  }

  /** Hands the chosen GIF to the box. */
  protected pickGif(g: GifResult): void {
    this.gif.emit(g);
  }

  // ---- stickers
  protected pickSticker(s: Sticker): void {
    this.sticker.emit(s);
  }

  /** Imports stickers from files (WhatsApp packs, images). */
  protected async importStickers(): Promise<void> {
    try {
      const { packs, stickers } = await this.stickers.pickAndImport();
      if (stickers)
        this.toast.success(
          this.i18n.t('Imported {n} stickers', { n: stickers }),
          packs > 1 ? this.i18n.t('{n} packs', { n: packs }) : undefined,
        );
    } catch (error) {
      this.toast.error(
        this.i18n.t('Could not import stickers'),
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  /** Adds the pack of the emoji as stickers. */
  protected async starter(): Promise<void> {
    await this.stickers.addStarterPack();
  }

  /** Deletes a pack of stickers. */
  protected async deletePack(pack: StickerPack): Promise<void> {
    await this.stickers.removePack(pack.id);
    this.activePackId.set(null);
  }

  /** Deletes one sticker of a pack. */
  protected async removeSticker(event: Event, pack: StickerPack, s: Sticker): Promise<void> {
    event.preventDefault();
    await this.stickers.removeSticker(pack.id, s.id);
  }

  @HostListener('document:mousedown') onOutside() {
    this.closed.emit();
  }
  @HostListener('document:keydown.escape') onEscape() {
    this.closed.emit();
  }
}
