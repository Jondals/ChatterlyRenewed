/**
 * src/app/shared/components/modal.component.ts
 * Generic modal window.
 */
import { Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div
      animate.leave="leave-fade"
      class="anim-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      (mousedown)="onBackdrop($event)"
      role="presentation"
    >
      <div
        animate.leave="leave-pop"
        class="panel anim-pop max-h-[92dvh] w-full overflow-y-auto p-4 sm:p-6"
        [style.maxWidth.px]="width()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold tracking-tight">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="mt-0.5 text-xs text-muted">{{ subtitle() }}</p>
            }
          </div>
          <button
            class="btn btn-icon btn-sm"
            type="button"
            (click)="closed.emit()"
            aria-label="Close"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly width = input(460);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape') onEscape() {
    this.closed.emit();
  }
  /** A press on the dark area around the window closes it. */
  onBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
