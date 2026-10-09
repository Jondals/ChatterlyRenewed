/**
 * src/app/layout/call-dock.component.ts
 * The floating bar of the call, shown when the person is on another page. It can be dragged by its handle and
 * dropped on one of six places (the corners and the middle of the top and the bottom), so it never has to sit over
 * what is being written. When music is playing it shows it with a pause button.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslatePipe } from '../core/i18n/i18n.service';
import { CallService } from '../core/services/call.service';
import { SettingsService } from '../core/services/settings.service';
import { IconComponent } from '../shared/components/icon.component';
import { DockableDirective, type DockPlace } from '../shared/util/dockable.directive';

/** Classes that put the bar in each place. */
const PLACE_CLASSES: Record<DockPlace, string> = {
  tl: 'left-4 top-[4.5rem]',
  tc: 'left-1/2 top-[4.5rem] -translate-x-1/2',
  tr: 'right-4 top-[4.5rem]',
  bl: 'left-4 bottom-5',
  bc: 'left-1/2 bottom-5 -translate-x-1/2',
  br: 'right-4 bottom-5',
};
/** The places, to draw the targets while the bar is dragged. */
const PLACES: DockPlace[] = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'];

/** Floating pill that follows you around while a call is running and you're on another page. */
@Component({
  selector: 'app-call-dock',
  standalone: true,
  imports: [IconComponent, RouterLink, TranslatePipe, DockableDirective],
  template: `
    @if (call.inCall() && !onVoicePage()) {
      @if (target()) {
        <div class="pointer-events-none fixed inset-0 z-[49]" aria-hidden="true">
          @for (place of places; track place) {
            <div
              class="dock-zone absolute"
              [class]="zoneClass(place)"
              [class.is-on]="target() === place"
            ></div>
          }
        </div>
      }
      <div
        appDockable
        class="anim-pop panel fixed z-50 flex select-none max-w-[calc(100vw-1.5rem)] items-center gap-2 !bg-ink-850 py-2 pl-2 pr-3"
        [class]="placeClass()"
        (docked)="settings.dockPlace.set($event)"
        (over)="target.set($event)"
      >
        <span
          data-drag
          class="dock-grip flex items-center gap-2 rounded-ui px-1.5 py-1"
          [attr.title]="'Drag to move' | t"
        >
          <span class="flex items-end gap-0.5">
            @for (d of [0, 120, 240, 60]; track $index) {
              <span class="eq-bar h-4 w-1 rounded-full bg-accent" [style.--d]="d + 'ms'"></span>
            }
          </span>
        </span>
        <a routerLink="/voice" class="leading-tight">
          <span class="block text-sm font-semibold hover:text-accent">{{
            'Call in progress' | t
          }}</span>
          <span class="block text-[11px] text-muted">{{ call.stats().rttMs ?? '—' }} ms</span>
        </a>
        @if (call.music(); as m) {
          <span class="mx-1 h-7 w-px bg-white/10"></span>
          <span class="flex min-w-0 items-center gap-1.5">
            <app-icon
              [name]="m.video ? 'play' : 'music'"
              [size]="14"
              class="shrink-0 text-accent"
            />
            <span class="max-w-32 truncate text-xs max-sm:hidden">{{ musicTitle() }}</span>
            @if (m.link.kind === 'youtube') {
              <button
                type="button"
                class="btn btn-icon btn-sm"
                [attr.aria-label]="(call.musicPaused() ? 'Play' : 'Pause') | t"
                (click)="call.pauseRequest.set(call.pauseRequest() + 1)"
              >
                <app-icon [name]="call.musicPaused() ? 'play' : 'pause'" [size]="14" />
              </button>
            }
          </span>
        }
        <span class="mx-1 h-7 w-px bg-white/10"></span>
        <button
          class="btn btn-icon btn-sm"
          [class.btn-soft-danger]="call.muted()"
          type="button"
          (click)="call.toggleMute()"
          [attr.aria-label]="'Mute' | t"
        >
          <app-icon [name]="call.muted() ? 'mic-off' : 'mic'" [size]="15" />
        </button>
        <button
          class="btn btn-icon btn-sm btn-danger"
          type="button"
          (click)="call.leave()"
          [attr.aria-label]="'Hang up' | t"
        >
          <app-icon name="phone" [size]="15" class="rotate-[135deg]" />
        </button>
      </div>
    }
  `,
  styles: `
    .dock-grip {
      cursor: var(--cur-grab, grab);
      touch-action: none;
    }
    .dock-grip:hover {
      background: rgba(255, 255, 255, 0.07);
    }
  `,
})
export class CallDockComponent {
  protected readonly call = inject(CallService);
  protected readonly settings = inject(SettingsService);
  private readonly router = inject(Router);
  protected readonly places = PLACES;
  /** The place under the bar while it is being dragged. */
  protected readonly target = signal<DockPlace | null>(null);
  protected readonly placeClass = computed(this.pickPlaceClass.bind(this));
  protected readonly onVoicePage = toSignal(
    this.router.events.pipe(
      filter(function (e) {
        return e instanceof NavigationEnd;
      }),
      map(
        function (this: CallDockComponent) {
          return this.router.url.startsWith('/voice');
        }.bind(this),
      ),
    ),
    { initialValue: this.router.url.startsWith('/voice') },
  );

  /** The classes of the place where the bar rests. */
  private pickPlaceClass(): string {
    return PLACE_CLASSES[this.settings.dockPlace()];
  }

  /** The classes of the target that marks a place while the bar is dragged. */
  protected zoneClass(place: DockPlace): string {
    return PLACE_CLASSES[place].replace('top-[4.5rem]', 'top-[4.5rem]');
  }

  /** The title of what plays, or the name of its service. */
  protected musicTitle(): string {
    const music = this.call.music();
    return music ? (this.call.musicTitles()[music.url] ?? 'YouTube') : '';
  }
}
