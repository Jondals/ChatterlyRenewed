import { Component } from '@angular/core';

@Component({
  selector: 'app-sidebar-layout',
  standalone: true,
  template: `
    <div class="w-16 bg-[#2b2d31] flex flex-col items-center py-3 gap-3">
      <div class="w-10 h-10 bg-indigo-500 rounded-full"></div>
      <div class="w-10 h-10 bg-gray-600 rounded-full"></div>
      <div class="w-10 h-10 bg-gray-600 rounded-full"></div>
    </div>
  `
})
export class SidebarLayoutComponent {}