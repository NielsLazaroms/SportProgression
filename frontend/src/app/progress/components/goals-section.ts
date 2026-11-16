import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../shared/app-icon';
import { extraWeightText } from '../../shared/bodyweight';
import { formatKg, plural, shortDate } from '../../shared/format';
import { GoalService } from '../data-access/goal.service';
import { Goal, GoalSet, LiftGoal, MAX_GOALS, MuscleGoal } from '../models/goal.model';
import { GoalSheet } from './goal-sheet';

/**
 * The lifter's goals with their progress, and the way to add or change one.
 * On an exercise page (`exercise` set) it shows only that exercise's goals and
 * a new goal starts on that exercise.
 */
@Component({
  selector: 'app-goals-section',
  standalone: true,
  imports: [AppIcon, MnSkeleton, MnTranslatePipe, GoalSheet],
  host: { class: 'block' },
  template: `
    <section class="mb-8" aria-labelledby="goals-head">
      <div class="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 id="goals-head" class="text-sm font-semibold text-on-surface-variant">
          {{ (exercise() ? 'goals.titleExercise' : 'goals.title') | mnTranslate }}
        </h2>
        @if (!loading() && shown().length && canAdd()) {
          <button type="button" (click)="openNew()" class="-my-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">
            <app-icon [data]="{ name: 'plus', size: 16 }" />
            {{ 'goals.add' | mnTranslate }}
          </button>
        }
      </div>

      @if (loading()) {
        <mn-skeleton [data]="{ shape: 'rectangle', height: '88px' }" class="rounded-2xl" />
      } @else if (shown().length) {
        <ul class="space-y-2">
          @for (g of shown(); track g.id) {
            <li>
              <button
                type="button"
                (click)="edit(g)"
                [attr.aria-label]="ariaFor(g)"
                class="glass-card block w-full rounded-2xl px-4 py-3 text-left transition-colors active:bg-surface-variant/30"
              >
                @if (g.kind === 'lift') {
                  @let done = g.progress.achieved;
                  <span class="flex items-start gap-3">
                    <span class="min-w-0 flex-1">
                      @if (!exercise()) {
                        <span class="block font-bold text-on-surface [overflow-wrap:anywhere]">{{ g.exerciseName }}</span>
                      }
                      <span class="tnum block text-sm font-semibold text-on-surface">{{ targetText(g) }}</span>
                    </span>
                    @if (done) {
                      <span class="flex shrink-0 items-center gap-1 text-sm font-bold text-success">
                        <app-icon [data]="{ name: 'check', size: 16 }" />
                        {{ 'goals.reached' | mnTranslate }}
                      </span>
                    } @else {
                      <span class="tnum shrink-0 text-sm font-bold text-on-surface">{{ g.progress.pct }}%</span>
                    }
                  </span>
                  <span class="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                    <span class="block h-full rounded-full" [class]="done ? 'bg-success' : 'bg-primary'" [style.width.%]="g.progress.pct"></span>
                  </span>
                  <span class="tnum mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-on-surface-variant">
                    <span>{{ liftStatus(g) }}</span>
                    @if (dateText(g); as d) { <span>{{ d }}</span> }
                  </span>
                } @else {
                  <span class="flex items-start gap-3">
                    <span class="min-w-0 flex-1">
                      <span class="block font-bold text-on-surface">{{ 'goals.muscle.title' | mnTranslate: { group: muscleLabel(g.muscleGroup) } }}</span>
                      <span class="tnum block text-sm font-semibold text-on-surface">{{ count('goals.muscle.target', g.targetSetsPerWeek) }}</span>
                    </span>
                    <span class="tnum shrink-0 text-sm font-bold" [class]="g.progress.pct >= 100 ? 'text-success' : 'text-on-surface'">
                      {{ g.progress.setsThisWeek }}/{{ g.targetSetsPerWeek }}
                    </span>
                  </span>
                  <span class="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                    <span class="block h-full rounded-full" [class]="g.progress.pct >= 100 ? 'bg-success' : 'bg-primary'" [style.width.%]="g.progress.pct"></span>
                  </span>
                  <span class="tnum mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-on-surface-variant">
                    <span>{{ muscleStatus(g) }}</span>
                    @if (dateText(g); as d) { <span>{{ d }}</span> }
                  </span>
                }
                @if (g.note) {
                  <span class="mt-1 block text-xs italic text-on-surface-variant [overflow-wrap:anywhere]">{{ g.note }}</span>
                }
              </button>
            </li>
          }
        </ul>
      } @else {
        <button
          type="button"
          (click)="openNew()"
          class="glass-card flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors active:bg-surface-variant/30"
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <app-icon [data]="{ name: 'target', size: 20 }" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-bold text-on-surface">{{ (exercise() ? 'goals.empty.exercise' : 'goals.empty.title') | mnTranslate }}</span>
            <span class="block text-sm text-on-surface-variant">{{ 'goals.empty.hint' | mnTranslate }}</span>
          </span>
          <app-icon [data]="{ name: 'chevron-right', size: 18 }" />
        </button>
      }
    </section>

    @if (sheetOpen()) {
      <app-goal-sheet
        [goal]="editing()"
        [presetExercise]="exercise()"
        (saved)="onSaved($event)"
        (closed)="closeSheet()"
      />
    }
  `,
})
export class GoalsSection implements OnInit {
  private readonly service = inject(GoalService);
  private readonly lang = inject(MnLanguageService);

  /** Only this exercise's goals (exercise progress page). */
  readonly exercise = input<{ id: number; name: string; bodyweight: boolean } | null>(null);

  readonly goals = signal<Goal[]>([]);
  readonly loading = signal(true);
  readonly sheetOpen = signal(false);
  readonly editing = signal<Goal | null>(null);

  readonly shown = computed(() => {
    const ex = this.exercise();
    const all = this.goals();
    return ex ? all.filter((g) => g.kind === 'lift' && g.exerciseDefinitionId === ex.id) : all;
  });
  readonly canAdd = computed(() => this.goals().length < MAX_GOALS);

  ngOnInit(): void {
    this.service.getAll().subscribe({
      next: (list) => {
        this.goals.set(list);
        this.loading.set(false);
      },
      // Goals are extra: a failure here must not break the page around it.
      error: () => this.loading.set(false),
    });
  }

  openNew(): void {
    this.editing.set(null);
    this.sheetOpen.set(true);
  }

  edit(g: Goal): void {
    this.editing.set(g);
    this.sheetOpen.set(true);
  }

  onSaved(list: Goal[]): void {
    this.goals.set(list);
    this.closeSheet();
  }

  closeSheet(): void {
    this.sheetOpen.set(false);
    this.editing.set(null);
  }

  // Plain methods (not computed): they must follow a language switch.
  muscleLabel(value: string): string {
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  count(key: string, n: number): string {
    return this.lang.t(plural(n, key), { n });
  }

  /** "100 kg × 5" / "20 reps" / "+10 kg × 5". */
  setText(set: { weightKg: number; reps: number }, bodyweight: boolean): string {
    const reps = `${set.reps} ${this.lang.t(plural(set.reps, 'unit.reps'))}`;
    if (bodyweight) {
      if (!(set.weightKg > 0)) return reps;
      return `${extraWeightText(set.weightKg, (k, p) => this.lang.t(k, p), this.lang.locale)} × ${set.reps}`;
    }
    return `${formatKg(set.weightKg, this.lang.locale)} ${this.lang.t('unit.kg')} × ${set.reps}`;
  }

  targetText(g: LiftGoal): string {
    return this.lang.t('goals.lift.target', {
      set: this.setText({ weightKg: g.targetWeightKg, reps: g.targetReps }, g.bodyweight),
    });
  }

  liftStatus(g: LiftGoal): string {
    const p = g.progress;
    if (p.achieved && p.achievedOn) {
      return this.lang.t('goals.lift.reachedOn', { date: this.day(p.achievedOn) });
    }
    if (!p.best) return this.lang.t('goals.lift.noSets');
    return this.lang.t('goals.lift.best', { set: this.best(p.best, g.bodyweight) });
  }

  muscleStatus(g: MuscleGoal): string {
    const earlier = g.progress.setsEarlierWeeks;
    const trained = earlier.filter((n) => n > 0);
    if (!trained.length) return this.lang.t('goals.muscle.thisWeek');
    const avg = Math.round(earlier.reduce((a, b) => a + b, 0) / earlier.length);
    return this.lang.t('goals.muscle.avg', { n: avg });
  }

  /** "By 1 Mar, 105 days left" / "By 1 Mar, 3 days late"; nothing once reached. */
  dateText(g: Goal): string | null {
    if (!g.targetDate || g.daysLeft == null) return null;
    if (g.kind === 'lift' && g.progress.achieved) return null;
    const date = this.day(g.targetDate);
    if (g.daysLeft > 0) return this.lang.t(plural(g.daysLeft, 'goals.date.left'), { date, n: g.daysLeft });
    if (g.daysLeft === 0) return this.lang.t('goals.date.today', { date });
    return this.lang.t(plural(-g.daysLeft, 'goals.date.late'), { date, n: -g.daysLeft });
  }

  ariaFor(g: Goal): string {
    const what =
      g.kind === 'lift'
        ? `${g.exerciseName}, ${this.targetText(g)}, ${g.progress.achieved ? this.lang.t('goals.reached') : g.progress.pct + '%'}`
        : `${this.lang.t('goals.muscle.title', { group: this.muscleLabel(g.muscleGroup) })}, ${g.progress.setsThisWeek}/${g.targetSetsPerWeek}`;
    return `${what}. ${this.lang.t('goals.editHint')}`;
  }

  private best(s: GoalSet, bodyweight: boolean): string {
    return this.setText(s, bodyweight);
  }

  private day(d: string): string {
    return shortDate(d, this.lang.locale);
  }
}
