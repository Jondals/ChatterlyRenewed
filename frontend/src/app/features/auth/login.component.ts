import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div class="flex items-center justify-center h-screen bg-[#1e1f22]">
      <div class="bg-[#2b2d31] p-6 rounded w-80">
        <h1 class="text-xl mb-4">Iniciar sesión</h1>

        <input class="w-full mb-3 p-2 bg-[#383a40] rounded" placeholder="Email" />
        <input class="w-full mb-3 p-2 bg-[#383a40] rounded" type="password" placeholder="Contraseña" />

        <button class="w-full bg-indigo-600 p-2 rounded">Entrar</button>
      </div>
    </div>
  `
})
export class LoginComponent {}