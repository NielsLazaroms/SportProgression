import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AnalysisSheet } from '../../../analysis/analysis-sheet';
import { SuggestSheet } from '../../../analysis/suggest-sheet';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { AuthService } from '../../../auth/data-access/auth.service';
import { WorkoutService } from '../../data-access/workout.service';
import { ProgressService } from '../../../progress/data-access/progress.service';
import { ProgressSummary } from '../../../progress/models/progress.model';
import { Workout, workoutSetCount } from '../../models/workout.model';
import { TemplateService } from '../../../templates/data-access/template.service';
import {
  WorkoutTemplate,
  templateSetCount,
} from '../../../templates/models/template.model';
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
    AnalysisSheet,
    SuggestSheet,
  ],
  templateUrl: './workouts-page.html',
})
export class WorkoutsPage implements OnInit {
  private readonly workoutService = inject(WorkoutService);
  private readonly progressService = inject(ProgressService);
  private readonly templateService = inject(TemplateService);
  private readonly lang = inject(MnLanguageService);

  /** The AI role: without it Home shows no AI entry point at all. */
  readonly canUseAi = inject(AuthService).canUseAi;
  /** The one look of every AI button on Home (the sparkles icon marks it as AI). */
  readonly aiButton =
    'flex min-h-11 w-full items-center gap-2 rounded-lg border border-control px-3 py-2 text-sm font-bold text-on-surface transition-colors hover:border-primary hover:text-primary';

  /** The AI analysis of this week; only asked for when opened. */
  readonly showAnalysis = signal(false);
  /** The plan sheet: a suggested next workout or a suggested week; null when closed. */
  readonly suggestMode = signal<'workout' | 'week' | null>(null);

  readonly workouts = signal<Workout[]>([]);
  /** Home only shows the last few; the full list lives in History. */
  readonly latest = computed(() => this.workouts().slice(0, 5));
  readonly loading = signal(true);
  /** i18n key explaining why loading failed; null when it worked. */
  readonly loadError = signal<string | null>(null);

  /** The user's templates; the row stays hidden until they have loaded. */
  readonly templates = signal<WorkoutTemplate[]>([]);
  readonly templatesLoaded = signal(false);

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

  /** "This week" numbers; stays null (stats hidden) on failure or no workouts. */
  readonly summary = signal<ProgressSummary | null>(null);
  readonly week = computed(() => {
    const s = this.summary();
    if (!s || !s.totals?.workouts || !s.thisWeek) return null;
    return {
      workouts: s.thisWeek.workouts,
      volumeKg: s.thisWeek.volumeKg,
      reps: s.thisWeek.reps ?? 0,
      /** A bodyweight-only week: no kilos moved, so the reps are the number to show. */
      showReps: !(s.thisWeek.volumeKg > 0) && (s.thisWeek.reps ?? 0) > 0,
      streakWeeks: s.streakWeeks ?? 0,
    };
  });

  // New-workout sheet; with `rerunSource` set it starts a re-run, with
  // `templateSource` set a workout from that template.
  readonly showNew = signal(false);
  readonly rerunSource = signal<Workout | null>(null);
  readonly templateSource = signal<WorkoutTemplate | null>(null);

  // template helpers
  readonly setCount = workoutSetCount;
  readonly templateSets = templateSetCount;
  readonly plural = plural;
  readonly volumeText = (kg: number) => compactKg(kg, this.lang.locale);
  readonly rel = (d: string) =>
    relativeDay(d, (k, p) => this.lang.t(k, p), this.lang.locale);

  /** Closing the plan sheet: a suggestion may have been saved as a template, so refresh that row. */
  closeSuggest(): void {
    this.suggestMode.set(null);
    this.templateService.getAll().subscribe({
      next: (list) => {
        this.templates.set(list);
        this.templatesLoaded.set(true);
      },
      error: () => undefined,
    });
  }

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
    this.templateService.getAll().subscribe({
      next: (list) => {
        this.templates.set(list);
        this.templatesLoaded.set(true);
      },
      // Home still works without the row; the Templates page reports errors.
      error: () => this.templatesLoaded.set(false),
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

  openNew(): void {
    this.rerunSource.set(null);
    this.templateSource.set(null);
    this.showNew.set(true);
  }

  /** Re-run: the normal new-workout sheet, prefilled from an earlier workout. */
  reRun(w: Workout): void {
    this.templateSource.set(null);
    this.rerunSource.set(w);
    this.showNew.set(true);
  }

  /** Start from a template: the same sheet, listing the planned exercises. */
  startTemplate(t: WorkoutTemplate): void {
    this.rerunSource.set(null);
    this.templateSource.set(t);
    this.showNew.set(true);
  }
}
