import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { WorkoutService } from '../../data-access/workout.service';
import { ProgressService } from '../../../progress/data-access/progress.service';
import { ProgressSummary } from '../../../progress/models/progress.model';
import { Workout, workoutSetCount } from '../../models/workout.model';
import { NewWorkoutSheet } from '../../components/new-workout-sheet';
import { WorkoutRow } from '../../components/workout-row';
import {
  compactKg,
  errorHintKey,
  plural,
  relativeDay,
  todayIso,
} from '../../../shared/format';

/** Yesterday in the user's own timezone as yyyy-mm-dd. */
function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

@Component({
  selector: 'app-workouts-page',
  standalone: true,
  imports: [
    AppHeader,
    RouterLink,
    AppIcon,
    MnSkeleton,
    MnTranslatePipe,
    NewWorkoutSheet,
    WorkoutRow,
  ],
  templateUrl: './workouts-page.html',
})
export class WorkoutsPage implements OnInit {
  private readonly workoutService = inject(WorkoutService);
  private readonly progressService = inject(ProgressService);
  private readonly lang = inject(MnLanguageService);

  readonly workouts = signal<Workout[]>([]);
  /** Home only shows the last few; the full list lives in History. */
  readonly latest = computed(() => this.workouts().slice(0, 5));
  readonly loading = signal(true);
  /** i18n key explaining why loading failed; null when it worked. */
  readonly loadError = signal<string | null>(null);

  /** Finished workouts with exercises — the ones worth running again. */
  readonly rerunnable = computed(() =>
    this.workouts()
      .filter((w) => !!w.completedAt && (w.exercises?.length ?? 0) > 0)
      .slice(0, 6),
  );

  /**
   * The workout to offer as "Continue": unfinished and dated today or
   * yesterday (older abandoned ones are left alone), preferring one that
   * already has sets.
   */
  readonly unfinished = computed(() => {
    const days = [todayIso(), yesterdayIso()];
    const open = this.workouts().filter(
      (w) => !w.completedAt && days.includes(w.date),
    );
    return open.find((w) => this.totalSets(w) > 0) ?? open[0] ?? null;
  });

  /** "This week" numbers; stays null (strip hidden) on failure or no workouts. */
  readonly summary = signal<ProgressSummary | null>(null);
  readonly week = computed(() => {
    const s = this.summary();
    if (!s || !s.totals?.workouts || !s.thisWeek) return null;
    return {
      workouts: s.thisWeek.workouts,
      volumeKg: s.thisWeek.volumeKg,
      streakWeeks: s.streakWeeks ?? 0,
    };
  });

  // New-workout sheet; with `rerunSource` set it starts a re-run instead.
  readonly showNew = signal(false);
  readonly rerunSource = signal<Workout | null>(null);

  // template helpers
  readonly setCount = workoutSetCount;
  readonly plural = plural;
  readonly volumeText = (kg: number) => compactKg(kg, this.lang.locale);
  readonly rel = (d: string) =>
    relativeDay(d, (k, p) => this.lang.t(k, p), this.lang.locale);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.workoutService.getWorkouts().subscribe({
      next: (data) => {
        this.workouts.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(errorHintKey(err));
      },
    });
    this.progressService.getSummary().subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }

  /** Every logged set, warm-ups included: "has this workout been started?" */
  private totalSets(w: Workout): number {
    return (w.exercises ?? []).reduce((n, ex) => n + (ex.sets?.length ?? 0), 0);
  }

  exerciseCount(w: Workout): number {
    return w.exercises?.length ?? 0;
  }

  openNew(): void {
    this.rerunSource.set(null);
    this.showNew.set(true);
  }

  /** Re-run: the normal new-workout sheet, prefilled from an earlier workout. */
  reRun(w: Workout): void {
    this.rerunSource.set(w);
    this.showNew.set(true);
  }
}
