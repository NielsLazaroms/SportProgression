import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../shared/app-icon';
import { compactKg, plural, relativeDay } from '../../shared/format';
import { Workout, workoutSetCount, workoutVolumeKg } from '../models/workout.model';

/**
 * One workout in a list (Home and History show the same row): a link to the
 * workout with name, state, date and "exercises · sets · volume" (working sets
 * only), plus a separate Re-run button for finished workouts.
 */
@Component({
  selector: 'app-workout-row',
  standalone: true,
  imports: [RouterLink, AppIcon, MnTranslatePipe],
  host: { class: 'block' },
  template: `
    @let w = workout();
    <div class="glass-card flex items-stretch rounded-xl">
      <a
        [routerLink]="['/workouts', w.id]"
        class="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-variant/20 active:bg-surface-variant/30"
      >
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-high"
          [class.text-primary]="w.completedAt"
          [class.text-on-surface-variant]="!w.completedAt"
        >
          <app-icon [data]="{ name: 'dumbbell', size: 22 }" />
        </span>
        <span class="block min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="truncate font-bold text-on-surface">{{ w.name }}</span>
            @if (w.completedAt) {
              <span class="shrink-0 text-success" role="img" [attr.aria-label]="'badge.finished' | mnTranslate">
                <app-icon [data]="{ name: 'check', size: 16 }" />
              </span>
            }
          </span>
          <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-surface-variant">
            <span>{{ day() }}</span>
            @if (!w.completedAt) {
              <span class="rounded-full border border-primary/50 px-2 py-0.5 text-xs font-semibold text-primary">
                {{ 'badge.inProgress' | mnTranslate }}
              </span>
            }
          </span>
          <span class="tnum mt-1 flex flex-wrap gap-x-1 text-sm text-on-surface-variant">
            <span class="whitespace-nowrap">{{ exercises() }} {{ plural(exercises(), 'unit.exercises') | mnTranslate }}</span>
            <span class="whitespace-nowrap">· {{ sets() }} {{ plural(sets(), 'unit.sets') | mnTranslate }}</span>
            @if (volume() > 0) {
              <span class="whitespace-nowrap">· <span class="font-semibold text-primary">{{ volumeText() }} {{ 'unit.kg' | mnTranslate }}</span></span>
            }
          </span>
        </span>
      </a>
      @if (w.completedAt && exercises() > 0) {
        <button
          type="button"
          (click)="rerun.emit(w)"
          [attr.aria-label]="'action.rerunNamed' | mnTranslate: { name: w.name }"
          [title]="'action.rerun' | mnTranslate"
          class="my-2 mr-2 flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full border border-outline-variant/60 text-primary transition-colors hover:bg-primary/15 active:bg-primary/25"
        >
          <app-icon [data]="{ name: 'rotate-ccw', size: 20 }" />
        </button>
      }
    </div>
  `,
})
export class WorkoutRow {
  private readonly lang = inject(MnLanguageService);

  readonly workout = input.required<Workout>();
  readonly rerun = output<Workout>();

  readonly plural = plural;

  readonly exercises = computed(() => this.workout().exercises?.length ?? 0);
  readonly sets = computed(() => workoutSetCount(this.workout()));
  readonly volume = computed(() => workoutVolumeKg(this.workout()));

  // Plain methods (not computed): they must follow a language switch.
  day(): string {
    return relativeDay(this.workout().date, (k, p) => this.lang.t(k, p), this.lang.locale);
  }

  volumeText(): string {
    return compactKg(this.volume(), this.lang.locale);
  }
}
