import { Injectable, computed, signal } from '@angular/core';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ironpulse.theme';

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable: follow the system */
  }
  return 'system';
}

/**
 * Light / dark theme. The choice ('system' by default) is kept in
 * localStorage; the resolved theme is written to `<html data-theme>`, which
 * the token overrides in `styles.css` key on. The inline script in
 * `index.html` does the same before first paint, so there is no flash.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
  private readonly systemTheme = signal<Theme>(this.media?.matches ? 'light' : 'dark');

  /** What the user picked in Profile. */
  readonly choice = signal<ThemeChoice>(readChoice());
  /** What is actually shown. */
  readonly theme = computed<Theme>(() => {
    const c = this.choice();
    return c === 'system' ? this.systemTheme() : c;
  });

  constructor() {
    // Follow the OS live while on "System".
    this.media?.addEventListener('change', (e) => {
      this.systemTheme.set(e.matches ? 'light' : 'dark');
      this.apply();
    });
    // Another tab changed the setting.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== STORAGE_KEY) return;
        this.choice.set(readChoice());
        this.apply();
      });
    }
    this.apply();
  }

  setChoice(choice: ThemeChoice): void {
    this.choice.set(choice);
    try {
      if (choice === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* storage unavailable: the choice lasts for this visit only */
    }
    this.apply();
  }

  private apply(): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', this.theme());
    // The browser chrome takes the page background of the theme now in effect.
    const surface = getComputedStyle(root).getPropertyValue('--color-surface').trim();
    if (surface) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);
    }
  }
}
