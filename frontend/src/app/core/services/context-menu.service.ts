/**
 * src/app/core/services/context-menu.service.ts
 * State of the app's own context menu (right click). The browser's menu is blocked everywhere, so each
 * component opens this one from its `contextmenu` event with the options that make sense there.
 */
import { Injectable, signal } from '@angular/core';

/** One option of the context menu. */
export interface MenuItem {
  label: string;
  icon?: string;
  /** Drawn in red (destructive actions). */
  danger?: boolean;
  /** A separator line goes before this option. */
  separator?: boolean;
  action: () => void;
}

/** Where the menu is open and what it offers. */
export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

/** The menu that is open now (null when none). */
@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  readonly state = signal<MenuState | null>(null);

  /** Opens the menu at the position of a mouse event; nothing opens when there are no options. */
  open(event: MouseEvent, items: MenuItem[]): void {
    event.preventDefault();
    event.stopPropagation();
    if (items.length === 0) {
      return;
    }
    this.state.set({ x: event.clientX, y: event.clientY, items });
  }

  /** Closes the menu. */
  close(): void {
    this.state.set(null);
  }
}
