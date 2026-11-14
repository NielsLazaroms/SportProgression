import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';

interface Tab {
  path: string;
  labelKey: string;
  icon: string;
  /** Other sections that are reached from this tab and light it up too. */
  also?: string[];
}

/**
 * Authenticated app shell: a scrolling content area (each page brings its own
 * header) plus the navigation — a fixed bottom tab bar on phones/tablets, a
 * fixed 15rem left sidebar from `lg` up (the page header is offset to match,
 * see `app-header`).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, AppIcon, MnTranslatePipe],
  template: `
    <div class="min-h-dvh bg-surface text-on-surface lg:pl-60">
      <router-outlet />

      <!-- Phones and tablets: bottom tab bar -->
      <nav
        [attr.aria-label]="'nav.label' | mnTranslate"
        class="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant/40 bg-surface-container/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div class="mx-auto flex max-w-2xl items-stretch justify-around px-1 py-2">
          @for (tab of tabs; track tab.path) {
            @let on = isActive(tab);
            <a
              [routerLink]="tab.path"
              [attr.aria-current]="on ? 'page' : null"
              class="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-colors"
              [class.text-primary-container]="on"
              [class.text-on-surface-variant]="!on"
            >
              <span
                class="flex h-8 items-center rounded-full px-3 transition-colors"
                [class.bg-primary-container]="on"
                [class.text-on-primary-container]="on"
              >
                <app-icon [data]="{ name: tab.icon, size: 22 }" />
              </span>
              <span class="max-w-full truncate text-xs font-semibold">{{ tab.labelKey | mnTranslate }}</span>
            </a>
          }
        </div>
      </nav>

      <!-- Desktop: left sidebar -->
      <nav
        [attr.aria-label]="'nav.label' | mnTranslate"
        class="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-outline-variant/40 bg-surface-container-low lg:flex"
      >
        <a routerLink="/workouts" class="flex h-16 shrink-0 items-center gap-2 px-5 text-primary">
          <app-icon [data]="{ name: 'dumbbell', size: 26 }" />
          <span class="font-display text-2xl font-extrabold tracking-tight">IRON PULSE</span>
        </a>
        <ul class="flex flex-col gap-1 overflow-y-auto px-3 py-4">
          @for (tab of tabs; track tab.path) {
            @let on = isActive(tab);
            <li>
              <a
                [routerLink]="tab.path"
                [attr.aria-current]="on ? 'page' : null"
                class="flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors"
                [class.bg-primary-container]="on"
                [class.text-on-primary-container]="on"
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
    { path: '/progress', labelKey: 'nav.progress', icon: 'chart-column' },
    { path: '/profile', labelKey: 'nav.profile', icon: 'user' },
  ];
}
