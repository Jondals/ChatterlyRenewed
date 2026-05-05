import { Component } from '@angular/core';

@Component({
  selector: 'app-channel-list',
  standalone: true,
  template: `
    <div class="w-60 bg-[#2b2d31] p-3">
      <h2 class="text-gray-400 text-sm mb-2">Canales</h2>

      <div class="space-y-1">
        <div class="p-2 hover:bg-[#3f4147] rounded cursor-pointer"># general</div>
        <div class="p-2 hover:bg-[#3f4147] rounded cursor-pointer"># memes</div>
      </div>
    </div>
  `
})
export class ChannelListComponent {}