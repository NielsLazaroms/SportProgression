import { Component, input, model } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { ExerciseType } from '../exercises/models/exercise.model';
import { formatNumber, plural } from './format';

type Translator = (key: string, params?: Record<string, string | number>) => string;

/**
 * One set of a BODYWEIGHT exercise as a sentence: "12 reps" for a plain set,
 * "8 reps · +10 kg" with extra weight. Never "0 kg", never a bare "10 kg".
 */
export function bodyweightSetText(
  reps: number | string,
  extraKg: number | string,
  t: Translator,
  locale: string,
): string {
  const r = Number(reps);
  const base = `${formatNumber(r, locale)} ${t(plural(r, 'unit.reps'))}`;
  return Number(extraKg) > 0 ? `${base} · ${extraWeightText(extraKg, t, locale)}` : base;
}

/** "+10 kg": weight added on top of the lifter's own body weight. */
export function extraWeightText(
  extraKg: number | string,
  t: Translator,
  locale: string,
): string {
  return `+${formatNumber(extraKg, locale)} ${t('unit.kg')}`;
}

/** Compact chip for a BODYWEIGHT set: "12 × BW" / "8 × +10" (`withUnit`: "8 × +10 kg"). */
export function bodyweightChipText(
  reps: number | string,
  extraKg: number | string,
  t: Translator,
  locale: string,
  withUnit = false,
): string {
  const kg = Number(extraKg);
  const load =
    kg > 0
      ? withUnit
        ? extraWeightText(kg, t, locale)
        : `+${formatNumber(kg, locale)}`
      : t('unit.bw');
  return `${formatNumber(reps, locale)} × ${load}`;
}

/**
 * Small "Bodyweight" tag for an exercise. `short` shows the compact unit label
 * ("BW" / "LG") with the full word as tooltip and for screen readers.
 */
@Component({
  selector: 'app-bw-tag',
  standalone: true,
  imports: [MnTranslatePipe],
  host: { class: 'inline-flex shrink-0 align-middle' },
  template: `
    <span
      class="inline-flex items-center rounded-full border border-outline-variant px-2 py-0.5 font-sans text-[11px] font-semibold normal-case leading-tight tracking-normal text-on-surface-variant"
      [attr.title]="short() ? ('bw.tag' | mnTranslate) : null"
    >
      @if (short()) {
        <span aria-hidden="true">{{ 'unit.bw' | mnTranslate }}</span>
        <span class="sr-only">{{ 'bw.tag' | mnTranslate }}</span>
      } @else {
        {{ 'bw.tag' | mnTranslate }}
      }
    </span>
  `,
})
export class BodyweightTag {
  readonly short = input(false);
}

/**
 * "Weights / Bodyweight" choice for the forms that create or edit an exercise.
 * Two-way: `[(type)]`.
 */
@Component({
  selector: 'app-exercise-type-toggle',
  standalone: true,
  imports: [MnTranslatePipe],
  host: { class: 'block' },
  template: `
    <p [id]="name() + '-label'" class="mb-1.5 text-sm font-semibold text-on-surface-variant">
      {{ 'bw.type.label' | mnTranslate }}
    </p>
    <div
      class="grid grid-cols-2 gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-1"
      role="group"
      [attr.aria-labelledby]="name() + '-label'"
      [attr.aria-describedby]="name() + '-hint'"
    >
      @for (o of options; track o.value) {
        <button
          type="button"
          (click)="type.set(o.value)"
          [attr.aria-pressed]="type() === o.value"
          [attr.data-type]="o.value"
          class="min-h-11 min-w-0 rounded-lg px-1 py-1 text-sm font-bold leading-tight transition-colors [overflow-wrap:anywhere]"
          [class]="type() === o.value ? 'bg-primary text-on-primary-container' : 'text-on-surface-variant'"
        >
          {{ o.label | mnTranslate }}
        </button>
      }
    </div>
    <p [id]="name() + '-hint'" class="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
      {{ 'bw.type.hint' | mnTranslate }}
    </p>
  `,
})
export class ExerciseTypeToggle {
  readonly type = model<ExerciseType>(ExerciseType.STRENGTH);
  /** Unique prefix for the label / hint ids. */
  readonly name = input('exercise-type');

  readonly options = [
    { value: ExerciseType.STRENGTH, label: 'bw.type.weights' },
    { value: ExerciseType.BODYWEIGHT, label: 'bw.type.bodyweight' },
  ];
}
