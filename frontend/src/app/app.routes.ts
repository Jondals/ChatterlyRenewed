/**
 * src/app/app.routes.ts
 * Routes of the application: the sign-in frame (login and register), the private area and the redirects.
 * The settings are a secondary route ("settings" outlet) that opens on top of whatever screen is showing.
 */
import { Routes } from '@angular/router';
import { authGuard, guestOnlyGuard } from './core/guards/auth-guard';
import { AuthShellComponent } from './features/auth/auth-shell.component';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';

/** Loads the shell of the private area (side bars and the page that changes). */
function loadMainLayout() {
  return import('./layout/main-layout.component').then(function pick(module) {
    return module.MainLayoutComponent;
  });
}

/** Loads the screen with friends and direct messages. */
function loadDirectHub() {
  return import('./features/direct/direct-hub.component').then(function pick(module) {
    return module.DirectHubComponent;
  });
}

/** Loads the screen of a group and its channels. */
function loadGroupView() {
  return import('./features/guild/group-view.component').then(function pick(module) {
    return module.GroupViewComponent;
  });
}

/** Loads the screen of a voice call. */
function loadVoiceStage() {
  return import('./features/voice/voice-route.component').then(function pick(module) {
    return module.VoiceRouteComponent;
  });
}

/** Loads the settings window. */
function loadSettings() {
  return import('./features/settings/settings.component').then(function pick(module) {
    return module.SettingsComponent;
  });
}

export const routes: Routes = [
  {
    path: '',
    canMatch: [guestOnlyGuard],
    component: AuthShellComponent,
    children: [
      // ? Signed out, the root address goes to the sign-in page (otherwise the frame would stay empty).
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
    ],
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: loadMainLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'direct' },
      { path: 'direct', loadComponent: loadDirectHub },
      { path: 'direct/:channelId', loadComponent: loadDirectHub },
      { path: 'groups', loadComponent: loadGroupView },
      { path: 'groups/:guildId', loadComponent: loadGroupView },
      { path: 'groups/:guildId/:channelId', loadComponent: loadGroupView },
      { path: 'voice', loadComponent: loadVoiceStage },
      // The settings open in a secondary outlet, on top of the current screen (which is not unloaded).
      { path: 'settings', outlet: 'settings', pathMatch: 'full', redirectTo: 'settings/profile' },
      { path: 'settings/:section', outlet: 'settings', loadComponent: loadSettings },
      { path: 'profile', redirectTo: 'direct' },
      { path: 'guilds', redirectTo: 'groups' },
    ],
  },
  { path: 'login', redirectTo: 'direct' },
  { path: 'register', redirectTo: 'direct' },
  { path: '**', redirectTo: 'login' },
];
