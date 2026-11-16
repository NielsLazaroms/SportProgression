import { Component, input, output } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { REPEAT_WEEK_OPTIONS } from './schedule.model';

/** "Repeat for 1 / 2 / 3 / 4 weeks", shared by the coach's week and Schedule a workout. */
@Component({
  selector: 'app-repeat-weeks-picker',
  standalone: true,
  imports: [MnTranslatePipe],
  host: { class: 'block' },
  template: `
    <p id="repeat-weeks-label" class="mb-1.5 text-sm font-semibold text-on-surface-variant">{{ 'schedule.repeat' | mnTranslate }}</p>
    <div role="radiogroup" aria-labelledby="repeat-weeks-label" class="grid grid-cols-4 gap-1 rounded-xl bg-surface-container-high p-1">
      @for (n of options; track n) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="value() === n"
          (click)="valueChange.emit(n)"
          class="min-h-11 rounded-lg px-1 text-sm font-semibold transition-colors"
          [class]="value() === n ? 'bg-surface-container text-primary shadow-sm' : 'text-on-surface-variant'"
        >
          {{ (n === 1 ? 'schedule.repeat.one' : 'schedule.repeat.n') | mnTranslate: { n: n } }}
        </button>
      }
    </div>
  `,
})
export class RepeatWeeksPicker {
  readonly value = input.required<number>();
  readonly valueChange = output<number>();
  readonly options = REPEAT_WEEK_OPTIONS;
}
