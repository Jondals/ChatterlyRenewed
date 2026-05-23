import { Component } from '@angular/core';

@Component({
  selector: 'app-userbar-layout',
  standalone: true,
  template: `
  <div
    class="w-full h-[72px] bg-[#232428] border-t border-[#1b1c1f] flex items-center justify-between px-3">

      <!-- Usuario -->
      <div class="flex items-center gap-2 min-w-0">

        <div class="relative">

          <img
            src="https://i.pravatar.cc/100"
            class="w-10 h-10 rounded-full object-cover">

          <div
            class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#232428] rounded-full">
          </div>

        </div>

        <div class="leading-tight">

          <div class="text-white text-sm font-semibold">
            Jondals
          </div>

          <div class="text-[#b5bac1] text-xs">
            En línea
          </div>

        </div>

      </div>

      <!-- Botones -->
      <div class="flex items-center">

        <button
          class="w-8 h-8 rounded-md hover:bg-[#35373c] flex items-center justify-center text-[#b5bac1] hover:text-white transition">
          🎤
        </button>

        <button
          class="w-8 h-8 rounded-md hover:bg-[#35373c] flex items-center justify-center text-[#b5bac1] hover:text-white transition">
          🎧
        </button>

        <button
          class="w-8 h-8 rounded-md hover:bg-[#35373c] flex items-center justify-center text-[#b5bac1] hover:text-white transition">
          ⚙️
        </button>

      </div>

    </div>
  `
})
export class UserbarLayoutComponent {}