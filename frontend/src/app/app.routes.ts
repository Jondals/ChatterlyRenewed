import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/server/server-list.component').then(m => m.ServerListComponent),
      },
      {
        path: 'channel/:id',
        loadComponent: () =>
          import('./features/chat/chat-view.component').then(m => m.ChatViewComponent),
      },
      {
        path: 'dm',
        loadComponent: () =>
          import('./features/dm/dm-view.component').then(m => m.DmViewComponent),
      }
    ]
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then(m => m.RegisterComponent),
  }
];