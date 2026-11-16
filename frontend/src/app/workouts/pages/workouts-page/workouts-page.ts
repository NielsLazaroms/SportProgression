import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MnAlertService, MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AiSheet } from '../../../analysis/ai-sheet';
import { AnalysisSheet } from '../../../analysis/analysis-sheet';
import { AnalysisService } from '../../../analysis/analysis.service';
import { SuggestSheet } from '../../../analysis/suggest-sheet';
import { AppIcon } from '../../../shared/app-icon';
import { HomeGoalsRow } from '../../../progress/components/home-goals-row';
import { ScheduleService } from '../../../schedule/schedule.service';
import { ScheduleStatus, ScheduledWorkout, scheduleStatus } from '../../../schedule/schedule.model';
import { ScheduledSheet } from '../../../schedule/scheduled-sheet';
import { HomeSchedule } from '../../../schedule/home-schedule';
import { AppHeader } from '../../../layout/app-header';
import { AuthService } from '../../../auth/data-access/auth.service';
import { WorkoutService } from '../../data-access/workout.service';
import { ProgressService } from '../../../progress/data-access/progress.service';
import { ProgressSummary } from '../../../progress/models/progress.model';
import {
  Workout,
  workoutSetCount,
} from '../../models/workout.model';
import { TemplateService } from '../../../templates/data-access/template.service';
import { TemplateStarter } from '../../../templates/data-access/template-starter';
import { WorkoutTemplate } from '../../../templates/models/template.model';
import { NewWorkoutSheet } from '../../components/new-workout-sheet';
import { GettingStarted, StartStep, StartStepId } from '../../components/getting-started';
import { GoalService } from '../../../progress/data-access/goal.service';
import { Goal } from '../../../progress/models/goal.model';
import { GoalSheet } from '../../../progress/components/goal-sheet';
import { StarterProgramsSheet } from '../../../templates/components/starter-programs-sheet';
import {
  compactKg,
  errorHintKey,
  plural,
  relativeDay,
  todayIso,
} from '../../../shared/format';

/** How long an account counts as new and gets the Get started card. */
const NEW_ACCOUNT_DAYS = 30;
/** From this many logged workouts on, someone is past getting started. */
const NEW_ACCOUNT_WORKOUTS = 3;

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
    HomeGoalsRow,
    HomeSchedule,
    ScheduledSheet,
    AppHeader,
    RouterLink,
    AppIcon,
    MnSkeleton,
    MnTranslatePipe,
    NewWorkoutSheet,
    AiSheet,
    AnalysisSheet,
    SuggestSheet,
    GettingStarted,
    GoalSheet,
    StarterProgramsSheet,
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly alerts = inject(MnAlertService);
  private readonly schedule = inject(ScheduleService);

  /** Days with a logged set: a plan on such a day counts as trained, not missed. */
  readonly trainedDates = computed(
    () =>
      new Set(
        this.workouts()
          .filter((w) => workoutSetCount(w) > 0)
          .map((w) => String(w.date).slice(0, 10)),
      ),
  );
  /** The plan for today that has not been started yet. */
  readonly todaysPlan = computed(
    () => this.schedule.items().find((i) => i.date === todayIso() && !i.workoutId) ?? null,
  );
  /** Today's plan as the main action; a workout already under way comes first. */
  readonly planToStart = computed(() => (this.unfinished() ? null : this.todaysPlan()));
  /** The planned workout whose sheet is open. */
  readonly openPlan = signal<{ item: ScheduledWorkout; status: ScheduleStatus } | null>(null);
  readonly startingPlan = signal(false);

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
    const plans = this.schedule.items();
    const trained = this.trainedDates();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const plan = plans.find((p) => p.date === date && !p.workoutId) ?? null;
      const done = this.workouts().filter(
        (w) => String(w.date).slice(0, 10) === date && workoutSetCount(w) > 0,
      );
      const sets = done.reduce((n, w) => n + workoutSetCount(w), 0);
      const name = t('profile.day.' + (i + 1));
      const state: 'trained' | 'scheduled' | 'missedPlan' | 'planned' | 'missed' | 'rest' = done.length
        ? 'trained'
        : plan
          ? date >= today
            ? 'scheduled'
            : 'missedPlan'
          : preferred.has(i + 1)
          ? date >= today
            ? 'planned'
            : 'missed'
          : 'rest';
      const label =
        state === 'trained'
          ? t('home.day.trained', { day: name, name: done.map((w) => w.name).join(', '), n: sets })
          : plan
            ? t('home.day.' + state, { day: name, name: plan.name })
            : t('home.day.' + state, { day: name });
      return {
        date,
        short: t('profile.day.short.' + (i + 1)),
        today: date === today,
        state,
        label,
        workoutId: done[0]?.id ?? null,
        plan,
        planStatus: plan ? scheduleStatus(plan, today, trained) : null,
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

  pickCoach(id: 'analyse' | 'workout' | 'week'): void {
    this.showCoach.set(false);
    if (id === 'analyse') this.showAnalysis.set(true);
    else this.suggestMode.set(id);
  }

  /** Today's plan becomes a workout with its targets, then the logging screen opens. */
  startTodaysPlan(): void {
    const plan = this.todaysPlan();
    if (!plan || this.startingPlan()) return;
    this.startingPlan.set(true);
    this.schedule.start(plan.id).subscribe({
      next: (w) => void this.router.navigate(['/workouts', w.id]).finally(() => this.startingPlan.set(false)),
      error: (err) => {
        this.startingPlan.set(false);
        this.alerts.error(this.lang.t('schedule.toast.start.err'), this.lang.t(errorHintKey(err)));
      },
    });
  }

  // ---- Get started: first steps for someone new, instead of empty boxes ----
  private readonly auth = inject(AuthService);
  private readonly goalService = inject(GoalService);
  /** Plans on the schedule (shared with the calendar). */
  readonly plans = this.schedule.items;
  /** Number of goals; null until known, so the card does not flash in. */
  readonly goalCount = signal<number | null>(null);
  /** Pieces of equipment set in My gym (AI users only); null until known. */
  readonly gymCount = signal<number | null>(null);
  readonly goalSheetOpen = signal(false);
  readonly showPrograms = signal(false);
  /** Bumped by "Hide" so the stored choice is read again. */
  private readonly hiddenTick = signal(0);
  /** Per account: someone else signing in on this device still gets the card. */
  readonly startHidden = computed(() => {
    this.hiddenTick();
    const id = this.auth.profile()?.id;
    if (!id) return true;
    try {
      return localStorage.getItem('getting-started-hidden:' + id) === '1';
    } catch {
      return false;
    }
  });

  readonly startSteps = computed<StartStep[]>(() => {
    const workout: StartStep = {
      id: 'workout',
      icon: 'plus',
      title: 'start.workout',
      hint: 'start.workout.hint',
      done: this.workouts().length > 0,
    };
    const goal: StartStep = {
      id: 'goal',
      icon: 'target',
      title: 'start.goal',
      hint: 'start.goal.hint',
      done: (this.goalCount() ?? 0) > 0,
    };
    const planned = this.plans().length > 0;
    if (this.canUseAi()) {
      return [
        { id: 'gym', icon: 'dumbbell', title: 'start.gym', hint: 'start.gym.hint', done: (this.gymCount() ?? 0) > 0 },
        { id: 'plan', icon: 'sparkles', title: 'start.planAi', hint: 'start.planAi.hint', done: planned },
        workout,
        goal,
      ];
    }
    return [
      workout,
      { id: 'template', icon: 'layers', title: 'start.program', hint: 'start.program.hint', done: this.templates().length > 0 },
      { id: 'plan', icon: 'calendar', title: 'start.plan', hint: 'start.plan.hint', done: planned },
      goal,
    ];
  });

  /**
   * Only for someone who is just starting: an account from the last 30 days
   * with fewer than 3 workouts logged. A user with real history never gets
   * it, also when their account looks new (a moved or imported database).
   */
  readonly isNewAccount = computed(() => {
    if (this.workouts().length >= NEW_ACCOUNT_WORKOUTS) return false;
    const created = Date.parse(this.auth.profile()?.createdAt ?? '');
    if (Number.isNaN(created)) return this.workouts().length === 0;
    return Date.now() - created < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
  });

  /** Shown to new accounts once everything it needs is known, until all steps are done or it is hidden. */
  readonly showStart = computed(
    () =>
      this.isNewAccount() &&
      !this.loading() &&
      !this.loadError() &&
      this.templatesLoaded() &&
      this.goalCount() !== null &&
      (!this.canUseAi() || this.gymCount() !== null) &&
      !this.startHidden() &&
      !this.startHiddenNow() &&
      this.startSteps().some((s) => !s.done),
  );

  startAct(id: StartStepId): void {
    if (id === 'workout') this.openNew();
    else if (id === 'goal') this.goalSheetOpen.set(true);
    else if (id === 'plan' && this.canUseAi()) this.suggestMode.set('week');
    else if (id === 'plan') void this.router.navigate(['/schedule']);
    else if (id === 'template') this.showPrograms.set(true);
    else if (id === 'gym') void this.router.navigate(['/my-gym']);
  }

  hideStart(): void {
    const id = this.auth.profile()?.id;
    try {
      if (id) localStorage.setItem('getting-started-hidden:' + id, '1');
    } catch {
      /* storage unavailable: the card comes back on the next visit */
    }
    this.startHiddenNow.set(true);
    this.hiddenTick.update((n) => n + 1);
  }
  /** Hidden for this visit even when storage is unavailable. */
  private readonly startHiddenNow = signal(false);

  /** A program was added: its templates (and maybe this week) are there now. */
  onProgramAdded(made: WorkoutTemplate[]): void {
    this.showPrograms.set(false);
    this.templates.update((list) => [...made, ...list]);
  }

  onGoalSaved(list: Goal[]): void {
    this.goalCount.set(list.length);
    this.goalSheetOpen.set(false);
  }

  private loadStart(): void {
    this.goalService.getAll().subscribe({
      next: (list) => this.goalCount.set(list.length),
      // Unknown: leave the card out rather than nag about a goal that may exist.
      error: () => undefined,
    });
    if (this.canUseAi()) {
      this.analysis.myGym().subscribe({
        next: (g) => this.gymCount.set(g.items.filter((i) => i.owned).length),
        error: () => undefined,
      });
    }
  }

  ngOnInit(): void {
    this.load();
    this.schedule.load();
    this.loadStart();
    // The calendar sends people here to let the coach plan their week.
    if (this.route.snapshot.queryParamMap.get('coach') === 'week' && this.canUseAi()) {
      this.suggestMode.set('week');
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
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
