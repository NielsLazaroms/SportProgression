import { Component, OnDestroy, OnInit, input, output, signal } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';
import { AiError } from './ai-error';

/**
 * The wait for an AI answer (20 to 60 seconds): a pulsing sparkles icon, the
 * main sentence, a status that moves on every few seconds, and the promise
 * that closing the sheet does not lose the answer.
 */
@Component({
  selector: 'app-ai-loading',
  standalone: true,
  imports: [AppIcon, MnTranslatePipe],
  template: `
    <div class="flex flex-col items-center px-2 py-8 text-center">
      <span
        aria-hidden="true"
        class="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-primary/15 text-primary motion-reduce:animate-none"
      >
        <app-icon [data]="{ name: 'sparkles', size: 28 }" />
      </span>
      <p class="mt-4 max-w-sm font-semibold leading-snug text-on-surface">{{ message() | mnTranslate }}</p>
      <p aria-hidden="true" class="mt-2 min-h-5 text-sm text-on-surface-variant">{{ steps()[step()] | mnTranslate }}</p>
      <p class="mt-4 max-w-sm text-xs leading-relaxed text-on-surface-variant">{{ 'analysis.loading.keep' | mnTranslate }}</p>
    </div>
  `,
})
export class AiLoading implements OnInit, OnDestroy {
  /** i18n key of the main sentence. */
  readonly message = input.required<string>();
  /** i18n keys of the rotating status lines. */
  readonly steps = input.required<string[]>();

  readonly step = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    // Stops at the last line: the answer can take longer than the list.
    this.timer = setInterval(() => this.step.update((i) => Math.min(i + 1, this.steps().length - 1)), 4000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

/** A failed AI request: icon, plain title and hint, "Try again" where it can help and always "Close". */
@Component({
  selector: 'app-ai-error',
  standalone: true,
  imports: [AppIcon, MnTranslatePipe],
  template: `
    @let e = error();
    <div class="flex flex-col items-center rounded-xl border border-outline-variant/40 px-4 py-8 text-center">
      <span aria-hidden="true" class="text-outline"><app-icon [data]="{ name: e.icon, size: 36 }" /></span>
      <p class="mt-3 font-bold text-on-surface">{{ e.title | mnTranslate }}</p>
      @if (e.hint; as hint) {
        <p class="mt-1 max-w-sm text-sm leading-relaxed text-on-surface-variant">{{ hint | mnTranslate }}</p>
      }
      <div class="mt-5 flex w-full max-w-xs flex-col gap-2">
        @if (e.retry) {
          <button
            type="button"
            (click)="retry.emit()"
            class="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-on-primary-container transition-transform active:scale-[0.98]"
          >
            {{ 'action.retry' | mnTranslate }}
          </button>
        }
        <button
          type="button"
          (click)="closed.emit()"
          class="flex min-h-11 items-center justify-center rounded-lg border border-control px-4 text-sm font-bold text-on-surface transition-colors hover:border-primary hover:text-primary"
        >
          {{ 'action.close' | mnTranslate }}
        </button>
      </div>
    </div>
  `,
})
export class AiErrorBox {
  readonly error = input.required<AiError>();
  readonly retry = output<void>();
  readonly closed = output<void>();
}
