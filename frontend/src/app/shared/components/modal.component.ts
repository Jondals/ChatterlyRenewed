import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    <div *ngIf="open" class="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div class="bg-[#2b2d31] p-4 rounded w-96">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class ModalComponent {
  @Input() open = false;
}