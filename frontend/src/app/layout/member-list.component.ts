import { Component } from '@angular/core';

@Component({
  selector: 'app-member-list',
  standalone: true,
  template: `
    <div class="w-60 bg-[#2b2d31] p-3">
      <h2 class="text-sm text-gray-400 mb-2">Miembros</h2>
      <div class="text-sm">Usuario1</div>
      <div class="text-sm">Usuario2</div>
    </div>
  `
})
export class MemberListComponent {}