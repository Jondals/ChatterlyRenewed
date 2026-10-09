/**
 * src/app/layout/context-menu.component.ts
 * Draws the context menu (right click) in the browser's top layer, next to the pointer and always inside
 * the window. It closes on any click elsewhere, on Escape, when the window loses focus and on resize.
 */
import { Component, ElementRef, HostListener, effect, inject, viewChild } from '@angular/core';
import { TranslatePipe } from '../core/i18n/i18n.service';
import { ContextMenuService, type MenuItem } from '../core/services/context-menu.service';
import { IconComponent } from '../shared/components/icon.component';

/** Space kept between the menu and the edge of the window, in pixels. */
const EDGE_GAP = 8;

/** The context menu drawn in the top layer of the browser. */
@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  template: `
    @if (menu.state(); as current) {
      <div
        #box
        popover="manual"
        class="popover-reset ctx-menu"
        role="menu"
        (mousedown)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        @for (item of current.items; track item.label) {
          @if (item.separator) {
            <div class="my-1 h-px bg-white/8"></div>
          }
          <button
            type="button"
            role="menuitem"
            class="ctx-item"
            [class.danger]="item.danger"
            (click)="choose(item)"
          >
            @if (item.icon) {
              <app-icon [name]="item.icon" [size]="15" />
            }
            <span>{{ item.label | t }}</span>
          </button>
        }
      </div>
    }
  `,
  styles: `
    .ctx-menu {
      position: fixed;
      min-width: 11.5rem;
      padding: 0.3rem;
      border-radius: var(--r);
      border: 1px solid var(--line);
      background: var(--ink-800);
      box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.7);
      animation: pop-in 0.14s var(--ease) both;
    }
    .ctx-item {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 0.6rem;
      padding: 0.45rem 0.6rem;
      border-radius: calc(var(--r) * 0.7);
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--fg);
      text-align: left;
    }
    .ctx-item:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .ctx-item.danger {
      color: #fca5a5;
    }
    .ctx-item.danger:hover {
      background: rgba(239, 68, 68, 0.16);
    }
  `,
})
export class ContextMenuComponent {
  protected readonly menu = inject(ContextMenuService);
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  constructor() {
    effect(this.place.bind(this));
  }

  /** Moves the menu to the pointer, measured once drawn so it never goes outside the window. */
  private place(): void {
    const current = this.menu.state();
    const node = this.box()?.nativeElement as
      | (HTMLElement & { showPopover?: () => void })
      | undefined;
    if (!current || !node) {
      return;
    }
    try {
      node.showPopover?.();
    } catch {
      // It was already open.
    }
    const left = Math.min(current.x, window.innerWidth - node.offsetWidth - EDGE_GAP);
    const top = Math.min(current.y, window.innerHeight - node.offsetHeight - EDGE_GAP);
    node.style.left = Math.max(EDGE_GAP, left) + 'px';
    node.style.top = Math.max(EDGE_GAP, top) + 'px';
  }

  /** Closes the menu and runs the chosen option. */
  protected choose(item: MenuItem): void {
    this.menu.close();
    item.action();
  }

  /** Any press outside the menu closes it (presses inside it stop here before they arrive). */
  @HostListener('document:mousedown')
  onPressOutside(): void {
    this.menu.close();
  }

  /** Escape closes the menu. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menu.close();
  }

  /** The menu closes when the window loses focus. */
  @HostListener('window:blur')
  onBlur(): void {
    this.menu.close();
  }

  /** The menu closes when the window changes size (its position would no longer be right). */
  @HostListener('window:resize')
  onResize(): void {
    this.menu.close();
  }
}
