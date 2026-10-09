/**
 * src/app/layout/soundboard-dock.component.ts
 * The soundboard of a call: many effects in folding categories and the person's own sounds. Whatever is played
 * is heard by everybody in the call (the sounds of the person are sent to the others once, encrypted).
 */
import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  EnvironmentInjector,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { I18nService, TranslatePipe } from '../core/i18n/i18n.service';
import { CallService } from '../core/services/call.service';
import { SoundboardStore, type CustomSound } from '../core/services/soundboard.store';
import {
  SOUNDBOARD,
  SOUNDBOARD_GROUPS,
  SoundService,
  type SfxId,
} from '../core/services/sound.service';
import { ToastService } from '../core/services/toast.service';
import { UiService } from '../core/services/ui.service';
import { IconComponent } from '../shared/components/icon.component';

/** A floating soundboard available anywhere. */
@Component({
  selector: 'app-soundboard-dock',
  standalone: true,
  imports: [IconComponent, NgTemplateOutlet, TranslatePipe],
  template: `
    @if (ui.soundboardOpen()) {
      @if (ui.soundboardAnchor(); as anchor) {
        <div
          animate.leave="leave-pop"
          class="sb-pop anim-pop fixed z-[75] flex max-h-[min(32rem,70dvh)] flex-col overflow-hidden rounded-ui-lg border border-white/10 bg-ink-800 shadow-2xl"
          [style.left.px]="left(anchor)"
          [style.bottom.px]="bottom(anchor)"
          [style.width.px]="width()"
          (mousedown)="$event.stopPropagation()"
        >
          <ng-container [ngTemplateOutlet]="board" />
        </div>
      } @else {
        <div
          animate.leave="leave-fade"
          class="anim-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-3 sm:p-4"
          (mousedown)="ui.soundboardOpen.set(false)"
        >
          <div
            animate.leave="leave-pop"
            class="anim-pop flex max-h-[min(40rem,90dvh)] w-[32rem] max-w-full flex-col overflow-hidden rounded-ui-lg border border-white/10 bg-ink-800 shadow-2xl"
            (mousedown)="$event.stopPropagation()"
          >
            <ng-container [ngTemplateOutlet]="board" />
          </div>
        </div>
      }
    }

    <ng-template #board>
      <div class="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
        <div>
          <div class="text-sm font-semibold">{{ 'Soundboard' | t }}</div>
          <div class="text-[11px] text-muted">
            {{
              call.inCall()
                ? 'Everybody in the call hears what you play.'
                : ('Join a call to share them: now only you hear them.' | t)
            }}
          </div>
        </div>
        <button
          type="button"
          class="btn btn-icon btn-sm btn-ghost"
          (click)="ui.soundboardOpen.set(false)"
          [attr.aria-label]="'Close' | t"
        >
          <app-icon name="x" [size]="15" />
        </button>
      </div>

      <div class="sb-tabs" role="tablist">
        @for (group of groups; track group.id) {
          <button
            type="button"
            role="tab"
            class="sb-pill"
            [class.is-on]="current() === group.id"
            [attr.aria-selected]="current() === group.id"
            (click)="current.set(group.id)"
          >
            <app-icon [name]="group.icon" [size]="14" />
            {{ group.label | t }}
          </button>
        }
        <button
          type="button"
          role="tab"
          class="sb-pill"
          [class.is-on]="current() === 'mine'"
          [attr.aria-selected]="current() === 'mine'"
          (click)="current.set('mine')"
        >
          <app-icon name="upload" [size]="14" />
          {{ 'Your sounds' | t }}
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        @if (current() !== 'mine') {
          <div class="sb-grid grid grid-cols-3 gap-2.5">
            @for (effect of inGroup(current()); track effect.id) {
              <button
                type="button"
                class="sb-tile anim-fade-up"
                [style.--d]="$index * 25 + 'ms'"
                [class.is-hit]="hit() === effect.id"
                (click)="playBuiltin(effect.id)"
              >
                <span class="emoji-glyph text-2xl leading-none">{{ effect.icon }}</span>
                <span class="w-full truncate text-[11px]">{{ effect.label | t }}</span>
              </button>
            }
          </div>
        } @else {
          <div class="sb-grid grid grid-cols-3 gap-2.5">
            @for (c of store.clips(); track c.id) {
              <div class="group relative">
                <button
                  type="button"
                  class="sb-tile h-full w-full"
                  [class.is-hit]="hit() === c.id"
                  (click)="playClip(c)"
                >
                  @if (c.emoji) {
                    <span class="emoji-glyph text-2xl leading-none">{{ c.emoji }}</span>
                  } @else {
                    <app-icon name="music" [size]="22" class="text-accent" />
                  }
                  <span class="w-full truncate text-[11px]">{{ c.name }}</span>
                </button>
                <button
                  type="button"
                  class="sb-act absolute left-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-accent group-hover:flex"
                  (click)="edit(c)"
                  [attr.aria-label]="'Edit the sound' | t"
                >
                  <app-icon name="edit" [size]="11" />
                </button>
                <button
                  type="button"
                  class="sb-act absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-red-300 group-hover:flex"
                  (click)="store.remove(c.id)"
                  [attr.aria-label]="'Delete' | t"
                >
                  <app-icon name="x" [size]="11" />
                </button>
              </div>
            }
            <button type="button" class="sb-tile sb-add" (click)="upload()">
              <app-icon name="plus" [size]="22" class="text-muted" />
              <span class="text-[11px]">{{ 'Add a sound' | t }}</span>
              <span class="text-[10px] text-dim">{{ 'Cut it, name it, add an emoji' | t }}</span>
            </button>
          </div>
          <p class="mt-3 text-[11px] leading-snug text-dim">
            {{
              'Add any audio file and keep the part you want (up to 30 seconds): you can cut it, rename it and give it an emoji. Everybody in the call hears it; it is sent once, encrypted, and kept only on your device.'
                | t
            }}
          </p>
        }
      </div>
    </ng-template>
  `,
  styles: `
    @media (hover: none) {
      .sb-act {
        display: flex;
      }
    }
  `,
})
export class SoundboardDockComponent {
  protected readonly ui = inject(UiService);
  protected readonly store = inject(SoundboardStore);
  protected readonly call = inject(CallService);
  private readonly sound = inject(SoundService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(EnvironmentInjector);
  protected readonly groups = SOUNDBOARD_GROUPS;
  /** The category shown (or 'mine' for the sounds of the person). */
  protected readonly current = signal('effects');
  /** The sound that was just played (it lights up for a moment). */
  protected readonly hit = signal<string | null>(null);
  private hitTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    void this.store.load();
    inject(DestroyRef).onDestroy(this.clearHit.bind(this));
  }

  /** Width of the board when it opens from the button of the call. */
  protected width(): number {
    return Math.min(560, window.innerWidth - 16);
  }

  /** Left edge of the board: centered over the button, kept inside the window. */
  protected left(anchor: DOMRect): number {
    const width = this.width();
    return Math.min(
      Math.max(8, anchor.left + anchor.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
  }

  /** Distance from the bottom of the window: the board opens upward from the button. */
  protected bottom(anchor: DOMRect): number {
    return window.innerHeight - anchor.top + 12;
  }

  /** Forgets the pending highlight. */
  private clearHit(): void {
    clearTimeout(this.hitTimer);
  }

  /** A press anywhere else closes the board (but not a press inside the window that edits a sound, which opens from it). */
  @HostListener('document:mousedown', ['$event']) closeOutside(event: MouseEvent) {
    if (!(event.target as Element).closest('app-sound-edit')) {
      this.ui.soundboardOpen.set(false);
    }
  }

  /** The effects of one category. */
  protected inGroup(group: string): typeof SOUNDBOARD {
    return SOUNDBOARD.filter(function same(effect) {
      return effect.group === group;
    });
  }

  /** Lights a sound up for a moment. */
  private flash(id: string): void {
    this.hit.set(id);
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(this.endFlash.bind(this), 500);
  }

  /** The highlight ends. */
  private endFlash(): void {
    this.hit.set(null);
  }

  /** Plays an effect: for everybody in the call, or only here when there is no call. */
  protected playBuiltin(id: SfxId): void {
    this.flash(id);
    if (this.call.inCall()) this.call.sendSfx(id);
    else this.sound.sfx(id);
  }

  /** Plays a sound of the person here and for the call. */
  protected playClip(clip: CustomSound): void {
    this.flash(clip.id);
    void this.call.sendClip(clip);
  }

  /** Adds a sound chosen by the person: it opens the window to cut and name it. */
  protected async upload(): Promise<void> {
    const file = await this.store.pickFile();
    if (!file) return;
    try {
      const editor = await import('../shared/components/sound-edit.component');
      if (file.size > editor.MAX_SOURCE_BYTES) {
        throw new Error('Sounds can be up to 25 MB.');
      }
      const result = await editor.editSound(
        this.injector,
        file,
        null,
        file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Sound',
      );
      if (result) {
        await this.store.save({ id: crypto.randomUUID(), createdAt: Date.now(), ...result });
        this.toast.success(this.i18n.t('Sound added'));
      }
    } catch (e) {
      this.toast.error(
        this.i18n.t('Could not add the sound'),
        this.i18n.t(e instanceof Error ? e.message : 'Unknown error'),
      );
    }
  }

  /**
   * Edits a sound: cut, name and emoji. The edited sound gets a new identity, so the people in a call (who keep the
   * sounds they received by identity) get the new one instead of the old.
   */
  protected async edit(clip: CustomSound): Promise<void> {
    try {
      const editor = await import('../shared/components/sound-edit.component');
      const result = await editor.editSound(
        this.injector,
        clip.original ?? clip.blob,
        clip,
        clip.name,
      );
      if (result) {
        await this.store.remove(clip.id);
        await this.store.save({ id: crypto.randomUUID(), createdAt: clip.createdAt, ...result });
        this.toast.success(this.i18n.t('Sound updated'));
      }
    } catch (e) {
      this.toast.error(
        this.i18n.t('Could not add the sound'),
        this.i18n.t(e instanceof Error ? e.message : 'Unknown error'),
      );
    }
  }
}
