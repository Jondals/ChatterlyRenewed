import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div class="flex-1 p-6 bg-[#313338]">
      <h1 class="text-xl mb-4">Configuración del servidor</h1>

      <div class="space-y-4 max-w-md">
        <input class="w-full p-2 bg-[#383a40] rounded" placeholder="Nombre del servidor" />
        <input class="w-full p-2 bg-[#383a40] rounded" placeholder="Icon URL" />

        <button class="bg-indigo-600 px-4 py-2 rounded">Guardar</button>
      </div>
    </div>
  `
})
export class ServerSettingsComponent {}