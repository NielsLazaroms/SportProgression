import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AiSheet } from '../../../analysis/ai-sheet';
import { AnalysisSheet } from '../../../analysis/analysis-sheet';
import { AnalysisService } from '../../../analysis/analysis.service';
import { SuggestSheet } from '../../../analysis/suggest-sheet';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { AuthService } from '../../../auth/data-access/auth.service';
import { WorkoutService } from '../../data-access/workout.service';
import { ProgressService } from '../../../progress/data-access/progress.service';
import { ProgressSummary } from '../../../progress/models/progress.model';
import {
  Workout,
  workoutRepCount,
  workoutSetCount,
  workoutVolumeKg,
} from '../../models/workout.model';
import { TemplateService } from '../../../templates/data-access/template.service';
import { TemplateStarter } from '../../../templates/data-access/template-starter';
import { WorkoutTemplate } from '../../../templates/models/template.model';
import { NewWorkoutSheet } from '../../components/new-workout-sheet';
import {
  compactKg,
  errorHintKey,
  plural,
  relativeDay,
  todayIso,
} from '../../../shared/format';

/** yyyy-mm-dd plus `n` days, in local time. */
function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The Monday of the week that holds `day`. */
function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDays(day, -offset);
}

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
    AiSheet,
    AnalysisSheet,
    SuggestSheet,
  ],
  templateUrl: './workouts-page.html',
})
export class WorkoutsPage implements OnInit {
  private readonly workoutService = inject(WorkoutService);
  private readonly progressService = inject(ProgressService);
  private readonly templateService = inject(TemplateService);
  private readonly starter = inject(TemplateStarter);
  /** Id of the template that is being started right now. */
  readonly startingTemplateId = this.starter.startingId;
  private readonly lang = inject(MnLanguageService);

  /** The AI role: without it Home shows no AI entry point at all. */
  readonly canUseAi = inject(AuthService).canUseAi;
  private readonly analysis = inject(AnalysisService);

  /** The coach menu (the three AI actions behind one row). */
  readonly showCoach = signal(false);
  readonly coachOptions: { id: 'analyse' | 'workout' | 'week'; title: string; hint: string }[] = [
    { id: 'analyse', title: 'analysis.week', hint: 'coach.analyse.hint' },
    { id: 'workout', title: 'suggest.workout', hint: 'coach.workout.hint' },
    { id: 'week', title: 'suggest.week', hint: 'coach.week.hint' },
  ];
  /** Preferred training days from Profile (1 = Monday ... 7 = Sunday); shown as empty sleeves on the bar. */
  readonly preferredDays = signal<number[]>([]);

  /** The AI analysis of this week; only asked for when opened. */
  readonly showAnalysis = signal(false);
  /** The plan sheet: a suggested next workout or a suggested week; null when closed. */
  readonly suggestMode = signal<'workout' | 'week' | null>(null);

  readonly workouts = signal<Workout[]>([]);
  /** Home only shows the last few; the full list lives in History. */
  readonly latest = computed(() => this.workouts().slice(0, 4));
  /** Home lists a handful of templates; the rest are one tap away. */
  readonly shownTemplates = computed(() => this.templates().slice(0, 3));
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

  // New-workout sheet; with `rerunSource` set it starts a re-run.
  readonly showNew = signal(false);
  readonly rerunSource = signal<Workout | null>(null);

  // template helpers
  readonly setCount = workoutSetCount;
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

  /**
   * This week (Monday to Sunday) as seven days: trained, a preferred training
   * day still to come, a preferred day that was missed, or a rest day.
   */
  readonly weekDays = computed(() => {
    const today = todayIso();
    const monday = mondayOf(today);
    const preferred = new Set(this.preferredDays());
    const t = (k: string, p?: Record<string, string | number>) => this.lang.t(k, p);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const done = this.workouts().filter(
        (w) => String(w.date).slice(0, 10) === date && workoutSetCount(w) > 0,
      );
      const sets = done.reduce((n, w) => n + workoutSetCount(w), 0);
      const name = t('profile.day.' + (i + 1));
      const state: 'trained' | 'planned' | 'missed' | 'rest' = done.length
        ? 'trained'
        : preferred.has(i + 1)
          ? date >= today
            ? 'planned'
            : 'missed'
          : 'rest';
      const label =
        state === 'trained'
          ? t('home.day.trained', { day: name, name: done.map((w) => w.name).join(', '), n: sets })
          : t('home.day.' + state, { day: name });
      return {
        date,
        short: t('profile.day.short.' + (i + 1)),
        today: date === today,
        state,
        label,
        workoutId: done[0]?.id ?? null,
      };
    });
  });

  readonly weekHasWorkouts = computed(() => this.weekDays().some((d) => d.state === 'trained'));

  // Plain methods (not computed): they must follow a language switch.
  todayLabel(): string {
    const text = new Date().toLocaleDateString(this.lang.locale === 'nl' ? 'nl-NL' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** The headline: how the week stands, as a sentence. */
  weekHeadline(): string {
    if (!this.loading() && !this.workouts().length) return this.lang.t('home.week.first');
    const n = this.weekDays().filter((d) => d.state === 'trained').length;
    if (!n) return this.lang.t('home.week.none');
    return this.lang.t(plural(n, 'home.week.count'), { n });
  }

  /** The line under it: the streak and what was moved this week. */
  weekLine(): string {
    const wk = this.week();
    if (!wk) return '';
    const parts: string[] = [];
    if (wk.streakWeeks > 1) parts.push(this.lang.t('home.week.streakLine', { n: wk.streakWeeks }));
    if (wk.showReps) parts.push(this.lang.t('home.week.repsLine', { n: wk.reps }));
    else if (wk.volumeKg > 0) parts.push(this.lang.t('home.week.volumeLine', { v: this.volumeText(wk.volumeKg) }));
    return parts.join(' ');
  }

  /** What a workout amounted to: volume, or reps for bodyweight-only work. */
  load_(w: Workout): string {
    const kg = workoutVolumeKg(w);
    if (kg > 0) return `${this.volumeText(kg)} ${this.lang.t('unit.kg')}`;
    const reps = workoutRepCount(w);
    return reps > 0 ? `${reps} ${this.lang.t(plural(reps, 'unit.reps'))}` : '';
  }

  pickCoach(id: 'analyse' | 'workout' | 'week'): void {
    this.showCoach.set(false);
    if (id === 'analyse') this.showAnalysis.set(true);
    else this.suggestMode.set(id);
  }

  ngOnInit(): void {
    this.load();
    if (this.canUseAi()) {
      this.analysis.coachPreferences().subscribe({
        next: (p) => this.preferredDays.set(p.trainingDays),
        error: () => undefined,
      });
    }
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
    this.showNew.set(true);
  }

  /** Re-run: the normal new-workout sheet, prefilled from an earlier workout. */
  reRun(w: Workout): void {
    this.rerunSource.set(w);
    this.showNew.set(true);
  }

  /** One tap: today's workout from the template, straight to logging. */
  startTemplate(t: WorkoutTemplate): void {
    this.starter.start(t);
  }
}
