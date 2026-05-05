import { Component } from '@angular/core';

@Component({
  selector: 'app-message-list',
  standalone: true,
  template: `
    <div class="p-4 space-y-2 overflow-y-auto h-full">
      <div class="text-sm">Usuario: Hola 👋</div>
      <div class="text-sm">Usuario2: Qué tal</div>
    </div>
  `
})
export class MessageListComponent {}