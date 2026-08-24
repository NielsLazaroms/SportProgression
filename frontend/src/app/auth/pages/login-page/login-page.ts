import { Component, inject } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AuthService } from '../../data-access/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [AppIcon, MnTranslatePipe],
  template: `
    <div class="relative flex min-h-dvh flex-col overflow-hidden bg-surface-container-lowest">
      <!-- Atmospheric background: no external asset, pure CSS glow -->
      <div class="pointer-events-none fixed inset-0 z-0">
        <div
          class="absolute -right-24 top-1/4 h-80 w-80 animate-pulse rounded-full bg-primary-container/20 blur-[110px]"
        ></div>
        <div
          class="absolute -left-24 bottom-1/4 h-80 w-80 animate-pulse rounded-full bg-primary-container/10 blur-[110px]"
          style="animation-delay: -4s"
        ></div>
      </div>

      <main class="relative z-10 flex flex-grow flex-col items-center justify-center px-6">
        <div class="mb-12 flex flex-col items-center text-center">
          <div
            class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_30px_rgba(86,141,255,0.25)]"
          >
            <app-icon [data]="{ name: 'dumbbell', size: 44 }" />
          </div>
          <h1
            class="mb-2 bg-gradient-to-br from-primary-container to-primary bg-clip-text font-display text-4xl font-extrabold uppercase tracking-tight text-transparent"
          >
            Iron Pulse
          </h1>
          <p class="max-w-[280px] leading-relaxed text-on-surface-variant/80">
            {{ 'login.tagline' | mnTranslate }}
          </p>
        </div>

        <div class="glass-card w-full max-w-sm rounded-2xl p-8 shadow-2xl">
          <div class="mb-8 text-center">
            <h2 class="font-display text-xl font-bold text-on-surface">{{ 'login.welcome' | mnTranslate }}</h2>
            <p class="mt-1 text-sm text-on-surface-variant">{{ 'login.access' | mnTranslate }}</p>
          </div>

          <button
            type="button"
            (click)="signIn()"
            class="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-white font-semibold text-[#08090c] shadow-lg transition-all duration-300 hover:bg-gray-50 active:scale-[0.98]"
          >
            <svg class="h-6 w-6 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            {{ 'login.google' | mnTranslate }}
          </button>

          <p class="mt-8 text-center text-sm leading-relaxed text-on-surface-variant/50">
            {{ 'login.agree' | mnTranslate }}<br />
            <a class="font-medium text-primary hover:underline" href="#">{{ 'login.terms' | mnTranslate }}</a>
            &amp;
            <a class="font-medium text-primary hover:underline" href="#">{{ 'login.privacy' | mnTranslate }}</a>
          </p>
        </div>
      </main>

      <footer class="relative z-10 flex items-center justify-center p-6">
        <p class="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant/40">
          {{ 'login.footer' | mnTranslate }}
        </p>
      </footer>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);

  signIn(): void {
    this.auth.loginWithGoogle();
  }
}
