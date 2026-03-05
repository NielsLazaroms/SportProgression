import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly BACKEND_URL = 'http://localhost:3000';

  constructor(private router: Router) {}

  loginWithGoogle(): void {
    window.location.href = `${this.BACKEND_URL}/auth/google`;
  }

  handleCallback(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.router.navigate(['/workouts']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.router.navigate(['/login']);
  }
}
