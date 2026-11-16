import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';
import { AppLogo } from '../shared/app-logo';

interface Tab {
  path: string;
  labelKey: string;
  icon: string;
  /** Other sections that are reached from this tab and light it up too. */
  also?: string[];
}

/**
 * Authenticated app shell: a scrolling content area (each page brings its own
 * header) plus the navigation: a fixed bottom tab bar on phones/tablets, a
 * fixed 15rem left sidebar from `lg` up (the page header is offset to match,
 * see `app-header`).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, AppIcon, AppLogo, MnTranslatePipe],
  template: `
    <div class="min-h-dvh bg-surface text-on-surface lg:pl-60">
      <router-outlet />

      <!-- Phones and tablets: a floating tab bar, clear of the screen edges -->
      <nav
        [attr.aria-label]="'nav.label' | mnTranslate"
        class="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-[1.75rem] border border-outline-variant/25 bg-surface-container-high/85 shadow-[0_10px_30px_rgb(0_0_0/0.35)] backdrop-blur-xl lg:hidden"
      >
        <div class="flex items-stretch justify-around gap-0.5 p-1.5">
          @for (tab of tabs; track tab.path) {
            @let on = isActive(tab);
            <a
              [routerLink]="tab.path"
              [attr.aria-current]="on ? 'page' : null"
              class="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-0.5 py-1.5 transition-colors"
              [class.bg-primary/15]="on"
              [class.text-primary]="on"
              [class.text-on-surface-variant]="!on"
            >
              <app-icon [data]="{ name: tab.icon, size: 20 }" />
              <!-- Five tabs: the label shrinks on narrow screens instead of breaking inside a word -->
              <span class="max-w-full whitespace-nowrap text-center text-[clamp(0.625rem,3.4vw,0.6875rem)] font-semibold leading-tight tracking-tight">{{ tab.labelKey | mnTranslate }}</span>
            </a>
          }
        </div>
      </nav>

      <!-- Desktop: left sidebar -->
      <nav
        [attr.aria-label]="'nav.label' | mnTranslate"
        class="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col bg-surface-container-low lg:flex"
      >
        <a routerLink="/workouts" class="flex h-16 shrink-0 items-center gap-2 px-5">
          <span class="text-primary"><app-logo [size]="26" /></span>
          <span class="font-display text-lg font-extrabold text-on-surface">Iron Pulse</span>
        </a>
        <ul class="flex flex-col gap-1 overflow-y-auto px-3 py-4">
          @for (tab of tabs; track tab.path) {
            @let on = isActive(tab);
            <li>
              <a
                [routerLink]="tab.path"
                [attr.aria-current]="on ? 'page' : null"
                class="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors"
                [class.bg-primary/15]="on"
                [class.text-primary]="on"
                [class.text-on-surface-variant]="!on"
                [class.hover:bg-surface-variant/40]="!on"
              >
                <app-icon [data]="{ name: tab.icon, size: 22 }" />
                {{ tab.labelKey | mnTranslate }}
              </a>
            </li>
          }
        </ul>
      </nav>
    </div>
  `,
})
export class Shell {
  private readonly router = inject(Router);

  /** Path of the current page, without query string or fragment. */
  private readonly path = signal(this.router.url.split(/[?#]/)[0]);

  constructor() {
    // The shell lives as long as the session, like the router itself.
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.path.set(e.urlAfterRedirects.split(/[?#]/)[0]);
      }
    });
  }

  /** True on the tab's own pages and on the sections reached from it. */
  isActive(tab: Tab): boolean {
    const path = this.path();
    return [tab.path, ...(tab.also ?? [])].some(
      (p) => path === p || path.startsWith(p + '/'),
    );
  }

  readonly tabs: Tab[] = [
    // Templates are opened from the Workouts tab.
    { path: '/workouts', labelKey: 'nav.workouts', icon: 'dumbbell', also: ['/templates'] },
    { path: '/history', labelKey: 'nav.history', icon: 'history' },
    { path: '/schedule', labelKey: 'nav.calendar', icon: 'calendar' },
    { path: '/progress', labelKey: 'nav.progress', icon: 'chart-column' },
    { path: '/profile', labelKey: 'nav.profile', icon: 'user' },
  ];
}
