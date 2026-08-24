import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AuthService } from '../../data-access/auth.service';

@Component({
  selector: 'app-auth-callback-page',
  standalone: true,
  imports: [MnTranslatePipe],
  template: `
    <div class="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface text-on-surface">
      <div
        class="h-10 w-10 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
        role="status"
      ></div>
      <p class="font-display text-sm font-semibold uppercase tracking-widest text-on-surface-variant">
        {{ 'callback.loading' | mnTranslate }}
      </p>
    </div>
  `,
})
export class AuthCallbackPage implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    // Cookies are already set by the backend redirect; verify then route in.
    this.auth.checkAuth().subscribe((loggedIn) => {
      this.router.navigate([loggedIn ? '/workouts' : '/login']);
    });
  }
}
