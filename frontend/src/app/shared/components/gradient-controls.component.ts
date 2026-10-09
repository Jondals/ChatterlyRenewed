/**
 * src/app/shared/components/gradient-controls.component.ts
 * The controls of a gradient, folded away until they are needed: a thin bar with a marker for each color (up to five),
 * which can be chosen and dragged along the bar, the color of the chosen marker and the angle.
 */
import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n.service';
import { gradientCss, sortedStops, type GradientParts, type Stop } from '../util/gradient';
import { ColorPickerComponent } from './color-picker.component';
import { IconComponent } from './icon.component';

/** Edits the colors and the angle of a gradient and reports every change. */
@Component({
  selector: 'app-gradient-controls',
  standalone: true,
  imports: [ColorPickerComponent, IconComponent, TranslatePipe],
  template: `
    <div class="space-y-2.5">
      <div class="flex items-center gap-3">
        <div
          class="h-2.5 flex-1 rounded-full border border-white/10"
          [style.background]="css()"
        ></div>
        <button type="button" class="btn btn-sm" (click)="open.set(!open())">
          <app-icon name="settings" [size]="13" /> {{ (open() ? 'Hide' : 'Edit') | t }}
        </button>
      </div>
      @if (open()) {
        <div class="anim-fade-up space-y-3 rounded-ui border border-white/8 bg-black/15 p-3">
          <div
            #bar
            class="gbar"
            [style.background]="css()"
            (pointermove)="drag($event, bar)"
            (pointerup)="drop($event)"
            (pointercancel)="drop($event)"
          >
            @for (stop of parts().stops; track $index) {
              <button
                type="button"
                class="gstop"
                [class.is-on]="selected() === $index"
                [style.left.%]="stop.pos"
                [style.background]="stop.color"
                [attr.aria-label]="stop.color"
                (pointerdown)="grab($event, $index)"
              ></button>
            }
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <app-color-picker
              [value]="current().color"
              [size]="26"
              label="Color"
              (valueChange)="setColor($event)"
            />
            <span class="font-mono text-xs text-muted">{{ current().pos }}%</span>
            <span class="flex-1"></span>
            @if (parts().stops.length < 5) {
              <button
                type="button"
                class="btn btn-sm btn-icon"
                [attr.aria-label]="'Add a color' | t"
                (click)="add()"
              >
                <app-icon name="plus" [size]="14" />
              </button>
            }
            @if (parts().stops.length > 2) {
              <button
                type="button"
                class="btn btn-sm btn-icon btn-soft-danger"
                [attr.aria-label]="'Remove this color' | t"
                (click)="remove()"
              >
                <app-icon name="trash" [size]="14" />
              </button>
            }
          </div>
          <label class="block text-xs text-muted"
            >{{ 'Angle' | t }} <b class="float-right text-fg">{{ parts().angle }}°</b>
            <input
              type="range"
              min="0"
              max="360"
              class="mt-1 w-full accent-[var(--accent)]"
              [value]="parts().angle"
              (input)="changed.emit({ angle: +$any($event.target).value })"
          /></label>
        </div>
      }
    </div>
  `,
  styles: `
    .gbar {
      position: relative;
      height: 0.7rem;
      margin: 0.5rem 0.55rem;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      touch-action: none;
    }
    .gstop {
      position: absolute;
      top: 50%;
      width: 1.1rem;
      height: 1.1rem;
      margin: -0.55rem 0 0 -0.55rem;
      border-radius: 999px;
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
      cursor: var(--cur-grab, grab);
    }
    .gstop.is-on {
      width: 1.35rem;
      height: 1.35rem;
      margin: -0.675rem 0 0 -0.675rem;
      border-color: var(--accent);
      z-index: 1;
    }
  `,
})
export class GradientControlsComponent {
  readonly parts = input.required<GradientParts>();
  readonly changed = output<Partial<GradientParts>>();
  protected readonly open = signal(false);
  protected readonly selected = signal(0);
  private dragging = -1;

  /** The gradient as CSS (a straight bar for the preview). */
  protected css(): string {
    return gradientCss({ angle: 90, stops: this.parts().stops });
  }

  /** The chosen color. */
  protected current(): Stop {
    const stops = this.parts().stops;
    return stops[Math.min(this.selected(), stops.length - 1)]!;
  }

  /** The press on a marker chooses it and starts moving it. */
  protected grab(event: PointerEvent, index: number): void {
    this.selected.set(index);
    this.dragging = index;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** The marker follows the pointer along the bar. */
  protected drag(event: PointerEvent, bar: HTMLElement): void {
    if (this.dragging < 0) {
      return;
    }
    const box = bar.getBoundingClientRect();
    const pos = Math.round(
      Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100)),
    );
    this.update(this.dragging, { pos });
  }

  /** The marker is let go. */
  protected drop(event: PointerEvent): void {
    this.dragging = -1;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  /** Changes the color of the chosen marker. */
  protected setColor(color: string): void {
    this.update(this.selected(), { color });
  }

  /** Adds a color in the widest gap of the line. */
  protected add(): void {
    const sorted = sortedStops(this.parts().stops);
    let at = 50;
    let color = sorted[0]!.color;
    let widest = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]!.pos - sorted[i]!.pos;
      if (gap > widest) {
        widest = gap;
        at = Math.round((sorted[i + 1]!.pos + sorted[i]!.pos) / 2);
        color = sorted[i]!.color;
      }
    }
    const stops = [...this.parts().stops, { color, pos: at }];
    this.selected.set(stops.length - 1);
    this.changed.emit({ stops });
  }

  /** Removes the chosen color (there are always at least two). */
  protected remove(): void {
    const stops = this.parts().stops.filter(this.keep.bind(this));
    this.selected.set(0);
    this.changed.emit({ stops });
  }

  /** Every marker but the chosen one stays. */
  private keep(_stop: Stop, index: number): boolean {
    return index !== this.selected();
  }

  /** Replaces part of one stop. */
  private update(index: number, change: Partial<Stop>): void {
    const stops = this.parts().stops.map(function edit(stop, i) {
      return i === index ? { ...stop, ...change } : stop;
    });
    this.changed.emit({ stops });
  }
}
