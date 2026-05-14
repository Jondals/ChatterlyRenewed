import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component')
        .then(m => m.LoginComponent),
  },

  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component')
        .then(m => m.RegisterComponent),
  },

  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout.component')
        .then(m => m.MainLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/server/server-list.component')
            .then(m => m.ServerListComponent),
      },
      {
        path: 'channel/:id',
        loadComponent: () =>
          import('./features/chat/chat-view.component')
            .then(m => m.ChatViewComponent),
      },
      {
        path: 'dm',
        loadComponent: () =>
          import('./features/dm/dm-view.component')
            .then(m => m.DmViewComponent),
      }
    ]
  }
];