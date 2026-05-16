import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarLayoutComponent } from './sidebar-layout.component';
import { UserbarLayoutComponent } from './userbar-layout.component';
import { SocialbarLayoutComponent } from './socialbar-layout.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarLayoutComponent, SocialbarLayoutComponent, UserbarLayoutComponent],
  template: `
    <div class="flex h-screen bg-[#1e1f22] text-white">
      
      <!-- Sidebar -->
      <app-sidebar-layout></app-sidebar-layout>

      <!-- Socialbar -->
      <app-socialbar-layout></app-socialbar-layout>

      <!-- Userbar -->
      <app-userbar-layout></app-userbar-layout>

      <!-- Contenido principal -->
      <div class="flex flex-1">
        <router-outlet></router-outlet>
      </div>

    </div>
  `
})
export class MainLayoutComponent {}