import { Component, computed, input, output } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../shared/app-icon';

export type StartStepId = 'workout' | 'template' | 'plan' | 'goal' | 'gym';

export interface StartStep {
  id: StartStepId;
  icon: string;
  /** i18n keys. */
  title: string;
  hint: string;
  done: boolean;
}

/**
 * Home for someone new: a short list of first things to do instead of a row
 * of empty boxes. Every step is one tap to the real action and ticks itself
 * off from what the user has made; the card leaves once all are done or the
 * user hides it.
 */
@Component({
  selector: 'app-getting-started',
  standalone: true,
  imports: [AppIcon, MnTranslatePipe],
  host: { class: 'block' },
  template: `
    <section class="glass-card mb-8 rounded-2xl p-4" aria-labelledby="start-title">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 id="start-title" class="font-display text-xl font-bold text-on-surface">{{ 'start.title' | mnTranslate }}</h2>
          <p class="tnum text-sm text-on-surface-variant">
            {{ 'start.progress' | mnTranslate: { n: doneCount(), total: steps().length } }}
          </p>
        </div>
        <button
          type="button"
          (click)="hide.emit()"
          class="-mr-2 -mt-1 min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
        >
          {{ 'start.hide' | mnTranslate }}
        </button>
      </div>
      <div
        class="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-high"
        role="progressbar"
        [attr.aria-valuenow]="doneCount()"
        aria-valuemin="0"
        [attr.aria-valuemax]="steps().length"
        [attr.aria-label]="'start.title' | mnTranslate"
      >
        <div class="h-full rounded-full bg-primary transition-[width]" [style.width.%]="(doneCount() / steps().length) * 100"></div>
      </div>

      <ol class="mt-3 divide-y divide-outline-variant/25">
        @for (s of steps(); track s.id) {
          <li>
            @if (s.done) {
              <!-- Done: a filled tick and quiet text, nothing left to tap -->
              <div class="flex min-h-16 items-center gap-3 py-2.5">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary-container">
                  <app-icon [data]="{ name: 'check', size: 18 }" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold text-on-surface-variant line-through decoration-outline">{{ s.title | mnTranslate }}</span>
                  <span class="sr-only">{{ 'start.done' | mnTranslate }}</span>
                </span>
              </div>
            } @else {
              <button
                type="button"
                (click)="act.emit(s.id)"
                class="-mx-2 flex min-h-16 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors active:bg-surface-variant/30"
                [class.bg-primary/5]="s.id === next()"
              >
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  [class]="s.id === next() ? 'bg-primary/15 text-primary' : 'border border-outline-variant text-on-surface-variant'"
                >
                  <app-icon [data]="{ name: s.icon, size: 18 }" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-bold text-on-surface">{{ s.title | mnTranslate }}</span>
                  <span class="block text-sm text-on-surface-variant">{{ s.hint | mnTranslate }}</span>
                </span>
                <span class="shrink-0 text-outline" aria-hidden="true"><app-icon [data]="{ name: 'chevron-right', size: 18 }" /></span>
              </button>
            }
          </li>
        }
      </ol>
    </section>
  `,
})
export class GettingStarted {
  readonly steps = input.required<StartStep[]>();
  readonly act = output<StartStepId>();
  readonly hide = output<void>();

  readonly doneCount = computed(() => this.steps().filter((s) => s.done).length);
  /** The first open step gets the accent: the one to do now. */
  readonly next = computed(() => this.steps().find((s) => !s.done)?.id ?? null);
}
