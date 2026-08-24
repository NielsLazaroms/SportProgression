import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';

interface Tab {
  path: string;
  labelKey: string;
  icon: string;
}

/**
 * Authenticated app shell: a scrolling content area (each page brings its own
 * header) plus the fixed bottom tab bar.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppIcon, MnTranslatePipe],
  template: `
    <div class="min-h-dvh bg-surface text-on-surface">
      <router-outlet />

      <nav
        class="fixed bottom-0 inset-x-0 z-50 border-t border-outline-variant/40 bg-surface-container/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div class="mx-auto flex max-w-2xl items-center justify-around px-4 py-2">
          @for (tab of tabs; track tab.path) {
            <a
              [routerLink]="tab.path"
              routerLinkActive
              #rla="routerLinkActive"
              class="flex min-w-16 flex-col items-center gap-1 rounded-full px-4 py-1.5 transition-colors"
              [class.text-primary-container]="rla.isActive"
              [class.bg-primary-container]="false"
              [class.text-on-surface-variant]="!rla.isActive"
            >
              <span
                class="flex h-8 items-center rounded-full px-3 transition-colors"
                [class.bg-primary-container]="rla.isActive"
                [class.text-on-primary-container]="rla.isActive"
              >
                <app-icon [data]="{ name: tab.icon, size: 22 }" />
              </span>
              <span class="text-[11px] font-semibold tracking-wide">{{ tab.labelKey | mnTranslate }}</span>
            </a>
          }
        </div>
      </nav>
    </div>
  `,
})
export class Shell {
  readonly tabs: Tab[] = [
    { path: '/workouts', labelKey: 'nav.workouts', icon: 'dumbbell' },
    { path: '/history', labelKey: 'nav.history', icon: 'history' },
    { path: '/progress', labelKey: 'nav.progress', icon: 'chart-column' },
    { path: '/profile', labelKey: 'nav.profile', icon: 'user' },
  ];
}
