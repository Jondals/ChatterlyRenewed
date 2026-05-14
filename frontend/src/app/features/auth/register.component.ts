import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
  <div class="flex items-center justify-center min-h-screen bg-[#1e1f22] px-4">
    <div class="w-full max-w-sm bg-[#2b2d31] p-8 rounded-2xl shadow-2xl border border-[#3a3d44]">
      
      <!-- Title -->
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-white">Crear cuenta</h1>
        <p class="text-sm text-gray-400 mt-1">
          Únete y empieza ahora
        </p>
      </div>

      <!-- Inputs -->
      <div class="space-y-4">
        <input
          class="w-full p-3 bg-[#383a40] text-white rounded-lg outline-none border border-transparent focus:border-green-500 transition"
          placeholder="Username"
        />

        <input
          class="w-full p-3 bg-[#383a40] text-white rounded-lg outline-none border border-transparent focus:border-green-500 transition"
          placeholder="Email"
        />

        <input
          class="w-full p-3 bg-[#383a40] text-white rounded-lg outline-none border border-transparent focus:border-green-500 transition"
          type="password"
          placeholder="Contraseña"
        />
      </div>

      <!-- Register Button -->
      <button
        class="w-full mt-6 bg-green-600 hover:bg-green-500 transition text-white font-medium py-3 rounded-lg"
      >
        Registrarse
      </button>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-6">
        <div class="flex-1 h-px bg-[#444]"></div>
        <span class="text-xs text-gray-500">o</span>
        <div class="flex-1 h-px bg-[#444]"></div>
      </div>

      <!-- Login Link -->
      <p class="text-center text-sm text-gray-400">
        ¿Ya tienes cuenta?
        <a
          href="/login"
          class="text-green-400 hover:text-green-300 transition font-medium"
        >
          Inicia sesión
        </a>
      </p>
    </div>
  </div>
  `
})
export class RegisterComponent {}