import { Component } from '@angular/core';

@Component({
  selector: 'app-message-input',
  standalone: true,
  template: `
    <div class="p-3 border-t border-gray-700">
      <input
        type="text"
        placeholder="Escribe un mensaje..."
        class="w-full p-2 rounded bg-[#383a40] outline-none"
      />
    </div>
  `
})
export class MessageInputComponent {}