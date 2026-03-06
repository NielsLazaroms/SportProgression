import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface User {
  userId: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly BACKEND_URL = environment.backendUrl;
  private loggedIn$ = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  loginWithGoogle(): void {
    window.location.href = `${this.BACKEND_URL}/auth/google`;
  }

  /**
   * Check auth status by calling /auth/me.
   * Cookies are sent automatically with withCredentials.
   */
  checkAuth(): Observable<boolean> {
    return this.http
      .get<User>(`${this.BACKEND_URL}/auth/me`, { withCredentials: true })
      .pipe(
        tap(() => this.loggedIn$.next(true)),
        map(() => true),
        catchError(() => {
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
        next: () => {
          this.loggedIn$.next(false);
          this.router.navigate(['/login']);
        },
        error: () => {
          this.loggedIn$.next(false);
          this.router.navigate(['/login']);
        },
      });
  }
}
