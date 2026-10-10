/**
 * src/app/shared/components/page-header.component.ts
 * Page header with title, icon and actions.
 */
import { Component, inject, input } from '@angular/core';
import { UiService } from '../../core/services/ui.service';
import { NameColorDirective } from '../util/name-color.directive';
import { IconComponent } from './icon.component';

/** Slim header used by every page: mobile menu button, title, subtitle and an actions slot. */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IconComponent, NameColorDirective],
  template: `
    <header class="flex h-14 shrink-0 items-center gap-3 border-b border-white/6 px-4">
      <button
        class="btn btn-icon btn-sm btn-ghost lg:hidden"
        type="button"
        (click)="ui.sidebarOpen.set(true)"
        aria-label="Menu"
      >
        <app-icon name="menu" />
      </button>
      <ng-content select="[leading]" />
      @if (icon()) {
        <app-icon [name]="icon()" class="text-muted" />
      }
      <div class="min-w-0 flex-1 leading-tight">
        <h1
          class="truncate text-[0.9375rem] font-bold"
          [class]="titleClass()"
          [appNameColor]="titleColor()"
        >
          {{ title() }}
        </h1>
        @if (subtitle()) {
          <p class="truncate text-xs text-muted">{{ subtitle() }}</p>
        }
      </div>
      <ng-content />
    </header>
  `,
  host: { class: 'block shrink-0' },
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly icon = input('');
  readonly titleClass = input('');
  /** Color or gradient of the title when it is the name of a person. */
  readonly titleColor = input('');
  protected readonly ui = inject(UiService);
}
