import { Component, input, output } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';

/**
 * Fixed top app bar. Shows the Iron Pulse wordmark by default, or a back
 * button + page title when `title` is set. Right-side actions are projected.
 * From `lg` up it starts right of the shell's 15rem sidebar.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AppIcon, MnTranslatePipe],
  template: `
    <header
      class="fixed inset-x-0 top-0 z-50 flex h-16 lg:left-60 items-center justify-between border-b border-outline-variant/40 bg-surface/95 px-4 backdrop-blur-md"
    >
      <div class="flex min-w-0 items-center gap-2">
        @if (title()) {
          @if (showBack()) {
            <button
              type="button"
              (click)="back.emit()"
              [attr.aria-label]="'action.back' | mnTranslate"
              class="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant/50"
            >
              <app-icon [data]="{ name: 'arrow-left', size: 24 }" />
            </button>
          }
          <h1 class="truncate font-display text-xl font-bold tracking-tight text-on-surface">
            {{ title() }}
          </h1>
        } @else {
          <!-- The desktop sidebar already carries the logo. -->
          <span class="shrink-0 text-primary lg:hidden"><app-icon [data]="{ name: 'dumbbell', size: 26 }" /></span>
          <h1 class="truncate font-display text-2xl font-extrabold tracking-tight text-primary lg:hidden">
            IRON PULSE
          </h1>
        }
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <ng-content />
      </div>
    </header>
  `,
})
export class AppHeader {
  readonly title = input<string>('');
  readonly showBack = input<boolean>(true);
  readonly back = output<void>();
}
