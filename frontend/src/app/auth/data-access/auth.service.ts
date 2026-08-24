import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly BACKEND_URL = environment.backendUrl;
  private loggedIn$ = new BehaviorSubject<boolean>(false);

  /** Current user profile, populated by checkAuth()/loadProfile(). */
  readonly profile = signal<UserProfile | null>(null);

  readonly displayName = computed(() => {
    const p = this.profile();
    if (!p) return '';
    const full = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    return full || p.email;
  });

  loginWithGoogle(): void {
    window.location.href = `${this.BACKEND_URL}/auth/google`;
  }

  /** Check auth status via /auth/me. Cookies ride along with withCredentials. */
  checkAuth(): Observable<boolean> {
    return this.http
      .get<UserProfile>(`${this.BACKEND_URL}/auth/me`, { withCredentials: true })
      .pipe(
        tap((profile) => {
          this.profile.set(profile);
          this.loggedIn$.next(true);
        }),
        map(() => true),
        catchError(() => {
          this.profile.set(null);
          this.loggedIn$.next(false);
          return of(false);
        }),
      );
  }

  isLoggedIn(): Observable<boolean> {
    return this.checkAuth();
  }

  isLoggedInSync(): boolean {
    return this.loggedIn$.value;
  }

  refresh(): Observable<boolean> {
    return this.http
      .post(`${this.BACKEND_URL}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.loggedIn$.next(true)),
        map(() => true),
        catchError(() => {
          this.loggedIn$.next(false);
          return of(false);
        }),
      );
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
    this.profile.set(null);
    this.loggedIn$.next(false);
    this.router.navigate(['/login']);
  }
}
