/**
 * src/app/core/services/tooltip.service.ts
 * Global tooltips for every element with a data-tip attribute. They are drawn in one node outside the
 * interface (position: fixed), so no container with overflow can clip them and they always stay inside the window.
 */
import { Injectable } from '@angular/core';

/** Milliseconds the pointer must rest on an element before its tooltip appears. */
const SHOW_DELAY = 350;
/** Space kept between the tooltip and the element, and between the tooltip and the edge of the window. */
const GAP = 8;
/** Side opposite to each side. */
const OPPOSITE: Record<string, string> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

/**
 * Shows the tooltip of the element under the pointer. The preferred side is asked with `data-tip-pos`
 * (top, bottom, left or right) and flips to the opposite side when it does not fit.
 */
@Injectable({ providedIn: 'root' })
export class TooltipService {
  private node: HTMLDivElement | null = null;
  private target: HTMLElement | null = null;
  private timer: number | undefined;

  /** Starts listening to the pointer to show and hide tooltips. */
  constructor() {
    document.addEventListener('pointerover', this.onEnter.bind(this), true);
    document.addEventListener('pointerout', this.onLeave.bind(this), true);
    document.addEventListener('pointerdown', this.hide.bind(this), true);
    document.addEventListener('keydown', this.hide.bind(this), true);
    window.addEventListener('scroll', this.hide.bind(this), true);
    window.addEventListener('blur', this.hide.bind(this));
  }

  /** The pointer entered an element: start waiting if it has a tooltip. */
  private onEnter(event: Event): void {
    const element = (event.target as Element | null)?.closest?.('[data-tip]') as HTMLElement | null;
    if (!element || element === this.target) {
      return;
    }
    this.hide();
    this.target = element;
    this.timer = window.setTimeout(this.show.bind(this), SHOW_DELAY);
  }

  /** The pointer left an element: hide the tooltip unless it only moved to a child of the same element. */
  private onLeave(event: Event): void {
    const related = (event as PointerEvent).relatedTarget as Node | null;
    if (this.target && related && this.target.contains(related)) {
      return;
    }
    this.hide();
  }

  /** Hides the tooltip and cancels a pending one. */
  private hide(): void {
    window.clearTimeout(this.timer);
    this.target = null;
    this.node?.classList.remove('visible');
  }

  /** Creates the tooltip node the first time it is needed. */
  private ensureNode(): HTMLDivElement {
    if (!this.node) {
      this.node = document.createElement('div');
      this.node.className = 'app-tooltip';
      this.node.setAttribute('role', 'tooltip');
      document.body.appendChild(this.node);
    }
    return this.node;
  }

  /** Puts the tooltip next to its element, on the preferred side if it fits and on the opposite one if not. */
  private show(): void {
    const target = this.target;
    const text = target?.getAttribute('data-tip');
    if (!target || !text || !target.isConnected) {
      return;
    }
    const node = this.ensureNode();
    node.textContent = text;
    node.style.left = '0px';
    node.style.top = '0px';
    const box = target.getBoundingClientRect();
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const fits: Record<string, boolean> = {
      top: box.top - height - GAP >= GAP,
      bottom: box.bottom + height + GAP <= window.innerHeight - GAP,
      left: box.left - width - GAP >= GAP,
      right: box.right + width + GAP <= window.innerWidth - GAP,
    };
    const asked = target.getAttribute('data-tip-pos') ?? 'top';
    let side = asked in fits ? asked : 'top';
    if (!fits[side]) {
      side = OPPOSITE[side];
    }
    let x = box.left + box.width / 2 - width / 2;
    let y = box.top + box.height / 2 - height / 2;
    if (side === 'top') {
      y = box.top - height - GAP;
    } else if (side === 'bottom') {
      y = box.bottom + GAP;
    } else if (side === 'left') {
      x = box.left - width - GAP;
    } else {
      x = box.right + GAP;
    }
    x = Math.min(Math.max(GAP, x), window.innerWidth - width - GAP);
    y = Math.min(Math.max(GAP, y), window.innerHeight - height - GAP);
    node.style.left = Math.round(x) + 'px';
    node.style.top = Math.round(y) + 'px';
    node.classList.add('visible');
  }
}
