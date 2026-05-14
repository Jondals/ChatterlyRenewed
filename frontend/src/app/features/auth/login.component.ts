import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
  <div class="flex items-center justify-center min-h-screen bg-[#1e1f22] px-4">
    
    <div class="w-full max-w-sm bg-[#2b2d31] p-8 rounded-2xl shadow-2xl border border-[#3a3d44]">
      
      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-white tracking-tight">
          Iniciar sesión
        </h1>

        <p class="text-sm text-gray-400 mt-2">
          Bienvenido de nuevo
        </p>
      </div>

      <!-- Inputs -->
      <div class="space-y-4">
        <input
          class="w-full p-3 bg-[#383a40] text-white rounded-xl outline-none border border-[#4a4d55] focus:border-indigo-500 transition"
          placeholder="Email"
        />

        <input
          class="w-full p-3 bg-[#383a40] text-white rounded-xl outline-none border border-[#4a4d55] focus:border-indigo-500 transition"
          type="password"
          placeholder="Contraseña"
        />
      </div>

      <!-- Main Buttons -->
      <div class="grid grid-cols-2 gap-3 mt-6">
        
        <button
          class="bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition text-white font-semibold py-3 rounded-xl"
        >
          Entrar
        </button>

        <button
          class="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 active:scale-[0.98] transition text-indigo-300 font-semibold py-3 rounded-xl"
        >
          Invitado
        </button>

      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-7">
        <div class="flex-1 h-px bg-[#444]"></div>

        <span class="text-xs uppercase tracking-widest text-gray-500">
          continuar con
        </span>

        <div class="flex-1 h-px bg-[#444]"></div>
      </div>

      <!-- Social Login -->
      <div class="grid grid-cols-5 gap-3">

        <!-- Google -->
        <button
          class="h-12 rounded-xl bg-[#383a40] hover:bg-[#44474f] border border-[#4a4d55] transition flex items-center justify-center text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2a9.96 9.96 0 0 1 6.29 2.226a1 1 0 0 1 .04 1.52l-1.51 1.362a1 1 0 0 1 -1.265 .06a6 6 0 1 0 2.103 6.836l.001 -.004h-3.66a1 1 0 0 1 -.992 -.883l-.007 -.117v-2a1 1 0 0 1 1 -1h6.945a1 1 0 0 1 .994 .89c.04 .367 .061 .737 .061 1.11c0 5.523 -4.477 10 -10 10s-10 -4.477 -10 -10s4.477 -10 10 -10z" />
          </svg>
        </button>

        <!-- Apple -->
        <button
          class="h-12 rounded-xl bg-[#383a40] hover:bg-[#44474f] border border-[#4a4d55] transition flex items-center justify-center text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M15.079 5.999l.239 .012c1.43 .097 3.434 1.013 4.508 2.586a1 1 0 0 1 -.344 1.44c-.05 .028 -.372 .158 -.497 .217a4.15 4.15 0 0 0 -.722 .431c-.614 .461 -.948 1.009 -.942 1.694c.01 .885 .339 1.454 .907 1.846c.208 .143 .436 .253 .666 .33c.126 .043 .426 .116 .444 .122a1 1 0 0 1 .662 .942c0 2.621 -3.04 6.381 -5.286 6.381c-.79 0 -1.272 -.091 -1.983 -.315l-.098 -.031c-.463 -.146 -.702 -.192 -1.133 -.192c-.52 0 -.863 .06 -1.518 .237l-.197 .053c-.575 .153 -.964 .226 -1.5 .248c-2.749 0 -5.285 -5.093 -5.285 -9.072c0 -3.87 1.786 -6.92 5.286 -6.92c.297 0 .598 .045 .909 .128c.403 .107 .774 .26 1.296 .508c.787 .374 .948 .44 1.009 .44h.016c.03 -.003 .128 -.047 1.056 -.457c1.061 -.467 1.864 -.685 2.746 -.616l-.24 -.012z" />
            <path d="M14 1a1 1 0 0 1 1 1a3 3 0 0 1 -3 3a1 1 0 0 1 -1 -1a3 3 0 0 1 3 -3z" />
          </svg>
        </button>

        <!-- Facebook -->
        <button
          class="h-12 rounded-xl bg-[#383a40] hover:bg-[#44474f] border border-[#4a4d55] transition flex items-center justify-center text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3" />
          </svg>
        </button>

        <!-- X -->
        <button
          class="h-12 rounded-xl bg-[#383a40] hover:bg-[#44474f] border border-[#4a4d55] transition flex items-center justify-center text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8.267 3a1 1 0 0 1 .73 .317l.076 .092l4.274 5.828l5.946 -5.944a1 1 0 0 1 1.497 1.32l-.083 .094l-6.163 6.162l6.262 8.54a1 1 0 0 1 -.697 1.585l-.109 .006h-4.267a1 1 0 0 1 -.73 -.317l-.076 -.092l-4.276 -5.829l-5.944 5.945a1 1 0 0 1 -1.497 -1.32l.083 -.094l6.161 -6.163l-6.26 -8.539a1 1 0 0 1 .697 -1.585l.109 -.006h4.267z" />
          </svg>
        </button>

        <!-- GitHub -->
        <button
          class="h-12 rounded-xl bg-[#383a40] hover:bg-[#44474f] border border-[#4a4d55] transition flex items-center justify-center text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M5.315 2.1c.791 -.113 1.9 .145 3.333 .966l.272 .161l.16 .1l.397 -.083a13.3 13.3 0 0 1 4.59 -.08l.456 .08l.396 .083l.161 -.1c1.385 -.84 2.487 -1.17 3.322 -1.148l.164 .008l.147 .017l.076 .014l.05 .011l.144 .047a1 1 0 0 1 .53 .514a5.2 5.2 0 0 1 .397 2.91l-.047 .267l-.046 .196l.123 .163c.574 .795 .93 1.728 1.03 2.707l.023 .295l.007 .272c0 3.855 -1.659 5.883 -4.644 6.68l-.245 .061l-.132 .029l.014 .161l.008 .157l.004 .365l-.002 .213l-.003 3.834a1 1 0 0 1 -.883 .993l-.117 .007h-6a1 1 0 0 1 -.993 -.883l-.007 -.117v-.734c-1.818 .26 -3.03 -.424 -4.11 -1.878l-.535 -.766c-.28 -.396 -.455 -.579 -.589 -.644l-.048 -.019a1 1 0 0 1 .564 -1.918c.642 .188 1.074 .568 1.57 1.239l.538 .769c.76 1.079 1.36 1.459 2.609 1.191l.001 -.678l-.018 -.168a5.03 5.03 0 0 1 -.021 -.824l.017 -.185l.019 -.12l-.108 -.024c-2.976 -.71 -4.703 -2.573 -4.875 -6.139l-.01 -.31l-.004 -.292a5.6 5.6 0 0 1 .908 -3.051l.152 -.222l.122 -.163l-.045 -.196a5.2 5.2 0 0 1 .145 -2.642l.1 -.282l.106 -.253a1 1 0 0 1 .529 -.514l.144 -.047l.154 -.03z" />
          </svg>
        </button>

      </div>

      <!-- Register -->
      <p class="text-center text-sm text-gray-400 mt-8">
        ¿No tienes cuenta?

        <a
          href="/register"
          class="text-indigo-400 hover:text-indigo-300 transition font-semibold"
        >
          Regístrate
        </a>
      </p>

    </div>

  </div>
  `
})
export class LoginComponent {}