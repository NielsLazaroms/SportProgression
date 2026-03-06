import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { UrlTree } from '@angular/router';
import { AuthService } from '../auth/data-access/auth.service';
import { loginRedirectGuard } from './login-redirect-guard';

describe('loginRedirectGuard', () => {
  let authService: { isLoggedIn: ReturnType<typeof vi.fn>; getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { isLoggedIn: vi.fn(), getToken: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('should allow access to login when not logged in', () => {
    authService.isLoggedIn.mockReturnValue(false);
    const result = TestBed.runInInjectionContext(() => loginRedirectGuard({} as any, {} as any));
    expect(result).toBe(true);
  });

  it('should redirect to /workouts when already logged in', () => {
    authService.isLoggedIn.mockReturnValue(true);
    const result = TestBed.runInInjectionContext(() => loginRedirectGuard({} as any, {} as any));
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/workouts');
  });
});
