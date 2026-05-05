import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div class="flex flex-col w-60 bg-[#2b2d31] p-3">
      <h2 class="text-sm text-gray-400 mb-2">Canales</h2>
      <div class="cursor-pointer hover:bg-[#3f4147] p-2 rounded">
        # general
      </div>
      <div class="cursor-pointer hover:bg-[#3f4147] p-2 rounded">
        # random
      </div>
    </div>
  `
})
export class ServerListComponent {}