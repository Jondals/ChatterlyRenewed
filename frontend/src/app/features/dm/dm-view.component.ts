import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div class="flex flex-col flex-1 bg-[#313338]">

      <div class="h-12 border-b border-gray-700 flex items-center px-4">
        <span>Mensajes directos</span>
      </div>

      <div class="flex-1 p-4">
        <div class="text-sm">Selecciona una conversación</div>
      </div>

    </div>
  `
})
export class DmViewComponent {}