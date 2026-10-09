/**
 * src/app/features/settings/stickers-section.component.ts
 * Settings - Stickers: manage packs and import the WhatsApp ones.
 */
import { Component, inject } from '@angular/core';
import { I18nService, TranslatePipe } from '../../core/i18n/i18n.service';
import { StickerStore, type StickerPack } from '../../core/services/sticker.store';
import { ToastService } from '../../core/services/toast.service';
import { DialogService } from '../../core/services/dialog.service';
import { IconComponent } from '../../shared/components/icon.component';

/** Manage sticker packs (stored only on this device) and import WhatsApp stickers. */
@Component({
  selector: 'app-stickers-section',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  template: `
    <section class="mb-6 grid items-start gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <button type="button" class="drop-card" (click)="import()">
        <span class="drop-icon"><app-icon name="upload" [size]="26" /></span>
        <b class="text-base">{{ 'Choose files' | t }}</b>
        <span class="max-w-xs text-sm text-muted">{{
          'Bring your WhatsApp stickers: pick a .wastickers file (exported by a sticker-maker app), a .zip, or loose .webp / .png images.'
            | t
        }}</span>
        <span class="flex flex-wrap justify-center gap-1.5">
          <span class="chip">.wastickers</span>
          <span class="chip">.zip</span>
          <span class="chip">.webp</span>
          <span class="chip">.png</span>
        </span>
        <span class="text-[11px] text-dim">{{
          'Each sticker up to 1 MB; packs (.zip, .wastickers) up to 48 MB' | t
        }}</span>
      </button>
      <div class="flex flex-col gap-3 rounded-ui-lg border border-white/8 bg-black/20 p-4">
        <button class="btn justify-start" type="button" (click)="starter()">
          <app-icon name="smile" [size]="15" class="text-accent" />
          {{ 'Add emoji starter pack' | t }}
        </button>
        <details class="text-xs text-muted">
          <summary class="cursor-pointer text-sm font-semibold text-fg">
            {{ 'How do I get my WhatsApp stickers?' | t }}
          </summary>
          <ol class="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              {{
                'Android: open your files app → Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Stickers — those .webp files are your stickers.'
                  | t
              }}
            </li>
            <li>
              {{
                'Packs made with Sticker Maker apps can be exported as .wastickers — import that file directly.'
                  | t
              }}
            </li>
            <li>{{ 'WhatsApp Web / Desktop: right-click a sticker → Save image as…' | t }}</li>
          </ol>
        </details>
      </div>
    </section>

    @for (p of stickers.packs(); track p.id) {
      <section class="anim-fade-up mb-4 rounded-ui-lg border border-white/8 p-4">
        <div class="mb-3 flex items-center gap-3">
          <input
            class="input !h-9 max-w-xs !bg-transparent font-semibold"
            [value]="p.name"
            maxlength="40"
            (change)="stickers.rename(p.id, $any($event.target).value)"
            [attr.aria-label]="'Pack name' | t"
          />
          <span class="text-xs text-muted">{{ p.items.length }}</span>
          <span class="flex-1"></span>
          <button class="btn btn-sm btn-soft-danger" type="button" (click)="remove(p)">
            <app-icon name="trash" [size]="13" /> {{ 'Delete pack' | t }}
          </button>
        </div>
        <div class="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-10">
          @for (s of p.items; track s.id) {
            <button
              type="button"
              class="group relative aspect-square rounded-ui bg-white/[.04] p-1 hover:bg-white/10"
              (click)="stickers.removeSticker(p.id, s.id)"
              [attr.title]="'Click to remove' | t"
            >
              <img
                [src]="stickers.url(s)"
                alt=""
                loading="lazy"
                class="h-full w-full object-contain"
              />
              <span
                class="absolute inset-0 flex items-center justify-center rounded-ui bg-black/60 opacity-0 group-hover:opacity-100"
                ><app-icon name="trash" [size]="16"
              /></span>
            </button>
          }
        </div>
      </section>
    } @empty {
      <p class="py-10 text-center text-sm text-muted">{{ 'No sticker packs yet.' | t }}</p>
    }
  `,
})
export class StickersSectionComponent {
  protected readonly stickers = inject(StickerStore);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly i18n = inject(I18nService);

  constructor() {
    void this.stickers.load();
  }

  /** Imports stickers from the files the person chooses. */
  protected async import(): Promise<void> {
    try {
      const { packs, stickers } = await this.stickers.pickAndImport();
      if (stickers)
        this.toast.success(
          this.i18n.t('Imported {n} stickers', { n: stickers }),
          this.i18n.t('{n} packs', { n: packs }),
        );
    } catch (e) {
      this.toast.error(
        this.i18n.t('Could not import stickers'),
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  /** Adds the pack of the emoji as stickers. */
  protected async starter(): Promise<void> {
    await this.stickers.addStarterPack();
  }

  /** Asks to confirm and deletes a pack. */
  protected async remove(pack: StickerPack): Promise<void> {
    const t = function (this: StickersSectionComponent, k: string, p?: Record<string, string>) {
      return this.i18n.t(k, p);
    }.bind(this);
    if (
      await this.dialog.confirm(
        t('Delete {name}?', { name: pack.name }),
        t('The stickers are removed from this device.'),
        { danger: true, confirmLabel: t('Delete') },
      )
    ) {
      await this.stickers.removePack(pack.id);
    }
  }
}
