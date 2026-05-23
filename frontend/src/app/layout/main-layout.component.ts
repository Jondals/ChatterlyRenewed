import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarLayoutComponent } from './sidebar-layout.component';
import { UserbarLayoutComponent } from './userbar-layout.component';
import { SocialbarLayoutComponent } from './socialbar-layout.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarLayoutComponent,
    SocialbarLayoutComponent,
    UserbarLayoutComponent
  ],
  template: `
    <div class="flex h-screen overflow-hidden bg-[#1e1f22] text-white">

      <!-- Sidebar -->
      <app-sidebar-layout></app-sidebar-layout>

      <!-- Contenedor izquierda -->
      <div class="relative w-[260px] h-full">

        <!-- Socialbar -->
        <app-socialbar-layout></app-socialbar-layout>

        <!-- Userbar flotante -->
        <div class="absolute bottom-0 left-0 w-full">
          <app-userbar-layout></app-userbar-layout>
        </div>

      </div>

      <!-- Main -->
      <div class="flex-1 h-full">
        <router-outlet></router-outlet>
      </div>

    </div>
  `
})
export class MainLayoutComponent {}