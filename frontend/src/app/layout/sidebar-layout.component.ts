import { Component } from '@angular/core';

@Component({
  selector: 'app-sidebar-layout',
  standalone: true,
  template: `
    <aside class="w-[72px] h-screen bg-[#1e1f22] flex flex-col items-center py-3 gap-2">

      <!-- Add Server -->
      <button
        class="w-12 h-12 rounded-2xl bg-[#313338] hover:bg-green-600 transition-all duration-200 flex items-center justify-center group">
        
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-7 h-7 text-[#dbdee1] group-hover:text-white transition"
          viewBox="0 0 24 24"
          fill="currentColor">
          <path d="M11 5h2v14h-2z"/>
          <path d="M5 11h14v2H5z"/>
        </svg>
      </button>

      <!-- Discover -->
      <button
        class="w-12 h-12 rounded-2xl bg-[#313338] hover:bg-[#5865f2] transition-all duration-200 flex items-center justify-center group">
        
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5 text-[#dbdee1] group-hover:text-white transition"
          viewBox="0 0 24 24"
          fill="currentColor">

          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.93 7.36-2.29 6.88a1 1 0 0 1-.63.63l-6.88 2.29a.5.5 0 0 1-.64-.64l2.29-6.88a1 1 0 0 1 .63-.63l6.88-2.29a.5.5 0 0 1 .64.64Z"/>
        </svg>
      </button>

    </aside>
  `
})
export class SidebarLayoutComponent {}