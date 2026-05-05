import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarServersComponent } from './sidebar-servers.component';
import { MemberListComponent } from './member-list.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarServersComponent, MemberListComponent],
  template: `
    <div class="flex h-screen bg-[#1e1f22] text-white">
      
      <!-- Sidebar servidores -->
      <app-sidebar-servers></app-sidebar-servers>

      <!-- Contenido principal -->
      <div class="flex flex-1">
        <router-outlet></router-outlet>
      </div>

      <!-- Miembros -->
      <app-member-list></app-member-list>
    </div>
  `
})
export class MainLayoutComponent {}