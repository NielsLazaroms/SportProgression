import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, map, Observable, of, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  /** The AI role: whether analysis and plan features are available to this user. */
  aiAccess?: boolean;
  /** When the account was made (ISO date and time). */
  createdAt?: string;
  /** How much the weight + and - buttons change the weight, in kg. */
  weightStepKg?: number;
}

/** The steps Settings offers for the weight + and - buttons, in kg; "Custom" allows any other. */
export const WEIGHT_STEPS: readonly number[] = [1, 2, 2.5, 5];
/** What a custom step may be, in kg (the server checks the same). */
export const WEIGHT_STEP_MIN = 0.1;
export const WEIGHT_STEP_MAX = 50;

export interface AuthConfig {
  /** True when the backend exposes GET /auth/dev-login (demo user). */
  devLogin: boolean;
}

const SESSION_HINT = 'ironpulse.session';

export type RenewResult = 'ok' | 'denied' | 'unreachable';

/** 401/403 = the server refuses the session (as opposed to being unreachable). */
function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly BACKEND_URL = environment.backendUrl;
  private loggedIn$ = new BehaviorSubject<boolean>(false);

  /** Current user profile, populated by checkAuth()/loadProfile(). */
  readonly profile = signal<UserProfile | null>(null);

  /** How much the weight + and - buttons change the weight, in kg; 1 until the user picks another. */
  readonly weightStep = computed(() => this.profile()?.weightStepKg ?? 1);

  /** Saves the weight step; the buttons use it at once and go back when saving fails. */
  setWeightStep(weightStepKg: number): Observable<unknown> {
    const before = this.profile();
    if (before) this.profile.set({ ...before, weightStepKg });
    return this.http.put(`${this.BACKEND_URL}/account/weight-step`, { weightStepKg }).pipe(
      catchError((err: unknown) => {
        const now = this.profile();
        if (before && now) this.profile.set({ ...now, weightStepKg: before.weightStepKg });
        return throwError(() => err);
      }),
    );
  }

  /** True when this user may use the AI features (buttons are hidden otherwise). */
  readonly canUseAi = computed(() => this.profile()?.aiAccess === true);

  readonly displayName = computed(() => {
    const p = this.profile();
    if (!p) return '';
    const full = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    return full || p.email;
  });

  loginWithGoogle(): void {
    window.location.href = `${this.BACKEND_URL}/auth/google`;
  }

  /** Demo sign-in (only works when the backend enables it, see getConfig()). */
  loginAsDemoUser(): void {
    window.location.href = `${this.BACKEND_URL}/auth/dev-login`;
  }

  /** Public auth feature flags; resolves to all-off when the call fails. */
  getConfig(): Observable<AuthConfig> {
    return this.http
      .get<AuthConfig>(`${this.BACKEND_URL}/auth/config`)
      .pipe(catchError(() => of({ devLogin: false })));
  }

  /** Remembers across reloads that this browser had a session. */
  private get sessionHint(): boolean {
    try {
      return localStorage.getItem(SESSION_HINT) === '1';
    } catch {
      return false;
    }
  }
  private set sessionHint(value: boolean) {
    try {
      if (value) localStorage.setItem(SESSION_HINT, '1');
      else localStorage.removeItem(SESSION_HINT);
    } catch {
      /* storage unavailable: fall back to in-memory state only */
    }
  }

  private markSignedIn(profile?: UserProfile): true {
    if (profile) this.profile.set(profile);
    this.loggedIn$.next(true);
    this.sessionHint = true;
    return true;
  }

  private markSignedOut(): false {
    this.profile.set(null);
    this.loggedIn$.next(false);
    this.sessionHint = false;
    return false;
  }

  /**
   * Is the user signed in? Asks /auth/me; when the 15-minute access token has
   * expired it is renewed once with the refresh token and we ask again.
   *
   * Only a definite "no" from the server (401/403) counts as signed out. When
   * the server cannot be reached (offline, timeout, rate limit, 5xx) we keep
   * whatever we knew before: a lifter in a basement gym must not be thrown to
   * the login page because the network blinked.
   */
  checkAuth(): Observable<boolean> {
    const me = () =>
      this.http.get<UserProfile>(`${this.BACKEND_URL}/auth/me`, {
        withCredentials: true,
      });
    const unknown = () => of(this.loggedIn$.value || this.sessionHint);

    return me().pipe(
      map((profile) => this.markSignedIn(profile)),
      catchError((err) => {
        if (!isAuthError(err)) return unknown();
        return this.renewSession().pipe(
          switchMap((result) => {
            if (result === 'denied') return of(this.markSignedOut());
            if (result === 'unreachable') return unknown();
            return me().pipe(
              map((profile) => this.markSignedIn(profile)),
              catchError((e) =>
                isAuthError(e) ? of(this.markSignedOut()) : unknown(),
              ),
            );
          }),
        );
      }),
    );
  }

  isLoggedIn(): Observable<boolean> {
    return this.checkAuth();
  }

  isLoggedInSync(): boolean {
    return this.loggedIn$.value;
  }

  private renewInFlight: Observable<RenewResult> | null = null;

  /**
   * Rotates the session tokens. Single-flight: when several requests hit a
   * 401 at once they all share one refresh call: a second call with the same
   * (already rotated) token would be treated as token reuse and log the user out.
   */
  renewSession(): Observable<RenewResult> {
    if (!this.renewInFlight) {
      this.renewInFlight = this.http
        .post(`${this.BACKEND_URL}/auth/refresh`, {}, { withCredentials: true })
        .pipe(
          map((): RenewResult => {
            this.markSignedIn();
            return 'ok';
          }),
          catchError((err) =>
            of<RenewResult>(isAuthError(err) ? 'denied' : 'unreachable'),
          ),
          finalize(() => (this.renewInFlight = null)),
          shareReplay(1),
        );
    }
    return this.renewInFlight;
  }

  /** True when the session was renewed. */
  refresh(): Observable<boolean> {
    return this.renewSession().pipe(map((r) => r === 'ok'));
  }

  /** Everything the server stores about the signed-in user, as a JSON file. */
  exportData(): Observable<Blob> {
    return this.http.get(`${this.BACKEND_URL}/account/export`, {
      responseType: 'blob',
      withCredentials: true,
    });
  }

  /** Permanently deletes the account and all its data, then signs out. */
  deleteAccount(): Observable<void> {
    return this.http
      .delete(`${this.BACKEND_URL}/account`, { withCredentials: true })
      .pipe(map(() => this.afterLogout()));
  }

  /** The server says the session is over: forget it and go to sign-in. */
  sessionExpired(): void {
    this.markSignedOut();
    this.router.navigate(['/login']);
  }

  logout(): void {
    this.http
      .post(`${this.BACKEND_URL}/auth/logout`, {}, { withCredentials: true })
      .subscribe({
        next: () => this.afterLogout(),
        error: () => this.afterLogout(),
      });
  }

  private afterLogout(): void {
    this.markSignedOut();
    this.router.navigate(['/login']);
  }
}
