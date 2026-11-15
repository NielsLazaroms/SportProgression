import { Component, OnInit, inject, signal } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppLogo } from '../../../shared/app-logo';
import { AuthService } from '../../data-access/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [AppLogo, MnTranslatePipe],
  template: `
    <!-- Centred and small: the mark, the name and the way in. -->
    <div class="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-10">
      <main class="w-full max-w-sm text-center">
        <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <app-logo [size]="40" />
        </span>
        <h1 class="mt-4 font-display text-3xl font-extrabold tracking-tight text-on-surface">Iron Pulse</h1>
        <p class="mt-1 text-on-surface-variant">{{ 'login.tagline' | mnTranslate }}</p>

        <div class="mt-8 space-y-2">
          <button
            type="button"
            (click)="signIn()"
            class="flex min-h-13 w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 text-lg font-bold text-on-primary-container transition-transform active:scale-[0.98]"
          >
            <!-- Google's mark keeps Google's own colours -->
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white">
              <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
            </span>
            {{ 'login.google' | mnTranslate }}
          </button>

          @if (devLogin()) {
            <button
              type="button"
              (click)="demoSignIn()"
              class="glass-card flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-4 text-lg font-bold text-on-surface transition-colors hover:text-primary active:scale-[0.98]"
            >
              {{ 'login.demo' | mnTranslate }}
            </button>
          }
        </div>
      </main>
    </div>
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);

  /** Whether the backend offers the demo-user login (dev only). */
  readonly devLogin = signal(false);

  ngOnInit(): void {
    this.auth.getConfig().subscribe((c) => this.devLogin.set(!!c?.devLogin));
  }

  demoSignIn(): void {
    this.auth.loginAsDemoUser();
  }

  signIn(): void {
    this.auth.loginWithGoogle();
  }
}
