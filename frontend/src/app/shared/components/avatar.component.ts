import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <img
      [src]="src || 'https://via.placeholder.com/40'"
      class="w-10 h-10 rounded-full"
    />
  `
})
export class AvatarComponent {
  @Input() src?: string;
}