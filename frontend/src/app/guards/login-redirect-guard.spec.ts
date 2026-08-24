import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../auth/data-access/auth.service';
import { loginRedirectGuard } from './login-redirect-guard';

describe('loginRedirectGuard', () => {
  let authService: { isLoggedIn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { isLoggedIn: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('should allow access to login when not logged in', () => {
    authService.isLoggedIn.mockReturnValue(of(false));
    const result = TestBed.runInInjectionContext(() =>
      loginRedirectGuard({} as any, {} as any),
    ) as Observable<boolean | UrlTree>;
    result.subscribe((value) => expect(value).toBe(true));
  });

  it('should redirect to /workouts when already logged in', () => {
    authService.isLoggedIn.mockReturnValue(of(true));
    const result = TestBed.runInInjectionContext(() =>
      loginRedirectGuard({} as any, {} as any),
    ) as Observable<boolean | UrlTree>;
    result.subscribe((value) => {
      expect(value).toBeInstanceOf(UrlTree);
      expect((value as UrlTree).toString()).toBe('/workouts');
    });
  });
});
