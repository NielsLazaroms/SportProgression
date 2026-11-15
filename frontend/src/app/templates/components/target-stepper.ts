import { Component, input, output } from '@angular/core';
import { AppIcon } from '../../shared/app-icon';

/**
 * Whole-number stepper for a template target: − [ 3 ] +, typed values are
 * clamped to `min`..`max` when the field is left. All texts are passed in
 * already translated.
 *
 *   <app-target-stepper [value]="row.targetSets" [min]="1" [max]="20"
 *     [label]="'Sets'" [inputLabel]="…" [decLabel]="…" [incLabel]="…"
 *     (valueChange)="setSets(row, $event)" />
 */
@Component({
  selector: 'app-target-stepper',
  standalone: true,
  imports: [AppIcon],
  host: { class: 'block min-w-0' },
  template: `
    <span class="mb-1 block text-xs font-semibold text-on-surface-variant" aria-hidden="true">{{ label() }}</span>
    <div class="flex items-stretch overflow-hidden rounded-lg border border-control bg-surface-container focus-within:border-primary">
      <button
        type="button"
        tabindex="-1"
        (click)="step(-1)"
        [disabled]="value() <= min()"
        [attr.aria-label]="decLabel()"
        class="flex h-12 w-11 shrink-0 items-center justify-center text-on-surface-variant active:bg-surface-variant/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <app-icon [data]="{ name: 'minus', size: 18 }" />
      </button>
      <input
        #field
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="4"
        [value]="value()"
        (focus)="field.select()"
        (change)="commit(field)"
        (keydown.enter)="field.blur()"
        [attr.aria-label]="inputLabel()"
        class="tnum h-12 w-10 min-w-0 flex-1 bg-transparent px-1 text-center text-lg font-bold text-on-surface outline-none"
      />
      <button
        type="button"
        tabindex="-1"
        (click)="step(1)"
        [disabled]="value() >= max()"
        [attr.aria-label]="incLabel()"
        class="flex h-12 w-11 shrink-0 items-center justify-center text-on-surface-variant active:bg-surface-variant/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <app-icon [data]="{ name: 'plus', size: 18 }" />
      </button>
    </div>
  `,
})
export class TargetStepper {
  readonly value = input.required<number>();
  readonly min = input(1);
  readonly max = input(100);
  readonly label = input('');
  readonly inputLabel = input('');
  readonly decLabel = input('');
  readonly incLabel = input('');

  readonly valueChange = output<number>();

  private clamp(n: number): number {
    return Math.min(this.max(), Math.max(this.min(), n));
  }

  step(delta: number): void {
    const next = this.clamp(this.value() + delta);
    if (next !== this.value()) this.valueChange.emit(next);
  }

  /** Typed value: keep digits only, clamp, and show what was kept. */
  commit(field: HTMLInputElement): void {
    const digits = field.value.replace(/\D+/g, '');
    const next = digits ? this.clamp(parseInt(digits, 10)) : this.value();
    // Written back by hand: when the clamped value equals the old one the
    // binding sees no change and would leave the typed text standing.
    field.value = String(next);
    if (next !== this.value()) this.valueChange.emit(next);
  }
}
