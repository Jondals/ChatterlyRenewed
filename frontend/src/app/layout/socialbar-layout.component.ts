import { Component } from '@angular/core';

@Component({
  selector: 'app-socialbar-layout',
  standalone: true,
  template: `
    <aside class="w-full h-full bg-[#111214] border-r border-[#1e1f22] flex flex-col pb-[72px]">

      <!-- Search -->
      <div class="p-3 border-b border-[#1e1f22]">
        <button
          class="w-full h-10 rounded-lg bg-[#1e1f22] text-[#b5bac1] text-sm font-medium hover:bg-[#232428] transition">
          Busca o inicia una conversación
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex flex-col px-2 py-2 text-[#b5bac1]">

        <button
          class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#2b2d31] hover:text-white transition text-white">
          
          <!-- Friends Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 fill-current"
            viewBox="0 0 24 24">
            <path d="M17 20H7a4 4 0 0 1 0-8h10a4 4 0 0 1 0 8ZM7 10a3 3 0 1 1 3-3 3 3 0 0 1-3 3Zm10 0a3 3 0 1 1 3-3 3 3 0 0 1-3 3Z"/>
          </svg>

          <span class="text-[17px] font-medium">Amigos</span>
        </button>

        <button
          class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#2b2d31] hover:text-white transition">
          
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 fill-current"
            viewBox="0 0 24 24">
            <path d="M12 2 2 7v6c0 5 3.8 9.7 10 11 6.2-1.3 10-6 10-11V7Zm0 3 7 3.2V13c0 3.8-2.7 7.4-7 8.6C7.7 20.4 5 16.8 5 13V8.2Z"/>
          </svg>

          <span class="text-[17px] font-medium">Nitro</span>
        </button>

        <button
          class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#2b2d31] hover:text-white transition">
          
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 fill-current"
            viewBox="0 0 24 24">
            <path d="M4 4h16v4H4Zm0 6h7v10H4Zm9 0h7v10h-7Z"/>
          </svg>

          <div class="flex items-center justify-between w-full">
            <span class="text-[17px] font-medium">Tienda</span>

            <span
              class="bg-white text-black text-[10px] px-2 py-[2px] rounded-full font-bold">
              NUEVO
            </span>
          </div>
        </button>

        <button
          class="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#2b2d31] hover:text-white transition">
          
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 fill-current"
            viewBox="0 0 24 24">
            <path d="M12 2 14.4 8H21l-5.2 4 2 6L12 14l-5.8 4 2-6L3 8h6.6Z"/>
          </svg>

          <span class="text-[17px] font-medium">Misiones</span>
        </button>

        <!-- Divider -->
        <div class="h-px bg-[#2b2d31] my-2 mx-2"></div>

        <!-- DM Header -->
        <div class="flex items-center justify-between px-3 py-2">
          <span class="text-xs uppercase tracking-wide text-[#949ba4] font-bold">
            Mensajes directos
          </span>

          <button
            class="text-[#949ba4] hover:text-white text-xl leading-none">
            +
          </button>
        </div>

      </nav>
    </aside>
  `
})
export class SocialbarLayoutComponent {}