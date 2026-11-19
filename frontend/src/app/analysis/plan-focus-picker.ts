import { Component, input, output } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { PLAN_FOCUSES, PLAN_NOTE_MAX, PlanFocus, PlanRequest } from './analysis.service';

/**
 * "What should it focus on?": quick picks (Legs, Push, Pull...) and a short
 * note for one plan. "Bolt decides" is the default, so asking stays one tap.
 *
 *   <app-plan-focus-picker [value]="request()" (valueChange)="request.set($event)" />
 */
@Component({
  selector: 'app-plan-focus-picker',
  standalone: true,
  imports: [MnTranslatePipe],
  host: { class: 'block' },
  template: `
    <p
      [id]="idPrefix() + '-focus-label'"
      class="mb-1.5 text-sm font-semibold text-on-surface-variant"
    >
      {{
        (scope() === 'week' ? 'suggest.focus.question.week' : 'suggest.focus.question')
          | mnTranslate
      }}
    </p>
    <div
      role="radiogroup"
      [attr.aria-labelledby]="idPrefix() + '-focus-label'"
      class="flex flex-wrap gap-1.5"
    >
      @for (f of options; track f) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="value().focus === f"
          (click)="pick(f)"
          class="min-h-11 rounded-full px-4 text-sm font-semibold transition-colors"
          [class]="
            value().focus === f
              ? 'bg-primary text-on-primary-container'
              : 'bg-surface-container-high text-on-surface-variant'
          "
        >
          {{ 'suggest.focus.' + (f ?? 'auto') | mnTranslate }}
        </button>
      }
    </div>

    <label
      [for]="idPrefix() + '-focus-note'"
      class="mb-1.5 mt-4 block text-sm font-semibold text-on-surface-variant"
    >
      {{ 'suggest.focus.note' | mnTranslate }}
    </label>
    <input
      [id]="idPrefix() + '-focus-note'"
      type="text"
      [maxLength]="max"
      autocomplete="off"
      [attr.aria-describedby]="idPrefix() + '-focus-note-count'"
      [value]="value().note"
      (input)="valueChange.emit({ focus: value().focus, note: $any($event.target).value })"
      [placeholder]="'suggest.focus.note.ph' | mnTranslate"
      class="min-h-12 w-full rounded-xl bg-surface-container-high px-4 text-base text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary"
    />
    <p
      [id]="idPrefix() + '-focus-note-count'"
      class="tnum mt-1 px-1 text-right text-xs text-on-surface-variant"
    >
      {{ 'suggest.focus.note.count' | mnTranslate: { n: value().note.length, max: max } }}
    </p>
  `,
})
export class PlanFocusPicker {
  readonly value = input.required<PlanRequest>();
  /** Week plans ask for an emphasis, a single workout for its type. */
  readonly scope = input<'workout' | 'week'>('workout');
  /** Keeps the ids apart when two pickers are on one page. */
  readonly idPrefix = input('plan');
  readonly valueChange = output<PlanRequest>();

  readonly options: (PlanFocus | null)[] = [null, ...PLAN_FOCUSES];
  readonly max = PLAN_NOTE_MAX;

  pick(focus: PlanFocus | null): void {
    this.valueChange.emit({ focus, note: this.value().note });
  }
}
