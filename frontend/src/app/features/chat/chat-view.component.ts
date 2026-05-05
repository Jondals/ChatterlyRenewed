import { Component } from '@angular/core';
import { MessageListComponent } from './message-list.component';
import { MessageInputComponent } from './message-input.component';

@Component({
  standalone: true,
  imports: [MessageListComponent, MessageInputComponent],
  template: `
    <div class="flex flex-col flex-1 bg-[#313338]">

      <!-- Header -->
      <div class="h-12 border-b border-gray-700 flex items-center px-4">
        <span># general</span>
      </div>

      <app-message-list class="flex-1"></app-message-list>
      <app-message-input></app-message-input>

    </div>
  `
})
export class ChatViewComponent {}