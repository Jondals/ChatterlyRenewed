import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div class="flex items-center justify-center h-screen bg-[#1e1f22]">
      <div class="bg-[#2b2d31] p-6 rounded w-80">
        <h1 class="text-xl mb-4">Crear cuenta</h1>

        <input class="w-full mb-3 p-2 bg-[#383a40] rounded" placeholder="Username" />
        <input class="w-full mb-3 p-2 bg-[#383a40] rounded" placeholder="Email" />
        <input class="w-full mb-3 p-2 bg-[#383a40] rounded" type="password" placeholder="Contraseña" />

        <button class="w-full bg-green-600 p-2 rounded">Registrarse</button>
      </div>
    </div>
  `
})
export class RegisterComponent {}