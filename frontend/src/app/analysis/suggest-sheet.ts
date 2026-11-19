import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MnAlertService, MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { Observable, concatMap, forkJoin, from, map, of, switchMap, tap, toArray } from 'rxjs';
import { supersetLetter } from '../shared/superset';
import { AppIcon } from '../shared/app-icon';
import { errorHintKey, formatKg, todayIso } from '../shared/format';
import { TemplateService } from '../templates/data-access/template.service';
import { ScheduleService } from '../schedule/schedule.service';
import { addDays, assignDates } from '../schedule/schedule-dates';
import { repeatWeeks } from '../schedule/schedule.model';
import { RepeatWeeksPicker } from '../schedule/repeat-weeks-picker';
import { AiError, aiError } from './ai-error';
import { AiSheet } from './ai-sheet';
import { AiErrorBox, AiLoading } from './ai-states';
import {
  AnalysisService,
  NO_PLAN_REQUEST,
  PlanRequest,
  SuggestedExercise,
  SuggestedWorkout,
  Suggestion,
} from './analysis.service';
import { PlanFocusPicker } from './plan-focus-picker';

/** Longest template name the server accepts. */
const TEMPLATE_NAME_MAX = 100;

/**
 * Sheet that asks Claude for a plan and lets the user act on it: the next
 * workout (`mode="workout"`) or a whole week (`mode="week"`, after choosing
 * the number of training days). Both first ask what the plan should focus on
 * (Legs, Push, Pull... and a short note), unless a plan was made earlier today. Each proposed workout can be
 * started as a workout with targets or saved as a template; a week is put on
 * the schedule as a whole, on the dates shown on its days.
 *
 *   @if (suggestMode(); as mode) {
 *     <app-suggest-sheet [mode]="mode" (closed)="suggestMode.set(null)" />
 *   }
 */
@Component({
  selector: 'app-suggest-sheet',
  standalone: true,
  imports: [AppIcon, AiSheet, AiLoading, AiErrorBox, MnTranslatePipe, RepeatWeeksPicker, PlanFocusPicker],
  template: `
    @let week = mode() === 'week';
    <app-ai-sheet
      [title]="(week ? 'suggest.title.week' : 'suggest.title.workout') | mnTranslate"
      [announce]="announce()"
      [wide]="week && showsPlans() && plans().length > 1"
      (closed)="closed.emit()"
    >
      @if (asking()) {
        @if (week) {
        <p id="suggest-days-label" class="mb-4 font-display text-[1.5rem] font-extrabold leading-[1.2] tracking-tight text-on-surface">{{ 'suggest.days.question' | mnTranslate }}</p>
        <div
          role="group"
          aria-labelledby="suggest-days-label"
          class="grid grid-cols-5 gap-1.5"
        >
          @for (n of dayOptions; track n) {
            <button
              type="button"
              (click)="days.set(n)"
              [attr.aria-pressed]="days() === n"
              class="tnum min-h-13 rounded-xl font-display text-xl font-bold transition-colors"
              [class]="days() === n ? 'bg-primary text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'"
            >
              {{ n }}
            </button>
          }
        </div>
        <p class="mt-2 px-1 text-xs text-on-surface-variant">
          @if (preferredDays().length) {
            {{ 'suggest.days.preferred' | mnTranslate: { days: preferredDaysText() } }}
          } @else {
            {{ 'suggest.days.noPreferred' | mnTranslate }}
          }
        </p>
        }
        <app-plan-focus-picker
          idPrefix="suggest"
          [class]="week ? 'mt-5' : ''"
          [scope]="mode()"
          [value]="request()"
          (valueChange)="request.set($event)"
        />
        <button
          type="button"
          (click)="load(false)"
          class="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-lg font-bold text-on-primary-container transition-transform active:scale-[0.98]"
        >
          {{ (week ? 'suggest.days.go' : 'suggest.focus.go') | mnTranslate }}
        </button>
        <p class="mt-3 px-1 text-xs leading-relaxed text-on-surface-variant">{{ 'coach.disclosure' | mnTranslate }}</p>
      } @else if (loading()) {
        <app-ai-loading message="suggest.loading" [steps]="loadingSteps" />
      } @else if (error(); as e) {
        <app-ai-error [error]="e" (retry)="load(true)" (closed)="closed.emit()" />
      } @else {
        @if (!basedOnHistory()) {
          <div class="mb-4 rounded-2xl bg-primary/15 px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm font-bold text-on-surface">{{ 'suggest.general.title' | mnTranslate }}</p>
              <p class="mt-0.5 text-sm leading-relaxed text-on-surface-variant">{{ 'suggest.general.body' | mnTranslate }}</p>
            </div>
          </div>
        }
        @if (askedText(); as asked) {
          <p class="mb-3 px-1 text-sm text-on-surface-variant">{{ 'suggest.focus.asked' | mnTranslate: { asked: asked } }}</p>
        }
        @if (summary(); as text) {
          <p class="mb-4 hyphens-auto px-1 leading-relaxed text-on-surface-variant">{{ text }}</p>
        }
        <!-- Checked by the app, not by the coach: a week should train everything the lifter trains -->
        @if (week && uncovered().length) {
          <div class="mb-4 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3" role="status">
            <p class="text-sm font-bold text-on-surface">{{ 'suggest.uncovered.title' | mnTranslate: { groups: uncoveredText() } }}</p>
            <button type="button" (click)="load(true)" class="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
              <app-icon [data]="{ name: 'rotate-ccw', size: 16 }" />
              {{ 'suggest.again.week' | mnTranslate }}
            </button>
          </div>
        }

        <div class="grid gap-3" [class]="gridClass()">
          @for (plan of plans(); track $index; let i = $index) {
            <section
              class="flex min-w-0 flex-col rounded-2xl bg-surface-container-high p-4"
            >
              <h3 class="min-w-0">
                @if (week) {
                  <span class="mb-0.5 block text-sm font-semibold text-on-surface-variant">{{ dayLabel(plan, i) }}<span class="sr-only">: </span></span>
                }
                <span class="block hyphens-auto break-words font-display text-xl font-bold leading-snug text-on-surface">{{ plan.title }}</span>
              </h3>
              <!-- In a weekly plan every description takes exactly three lines, so the cards line up. -->
              <p
                class="mt-1 hyphens-auto text-sm leading-relaxed text-on-surface-variant"
                [class.line-clamp-3]="plans().length > 1"
                [style.min-height]="plans().length > 1 ? '3lh' : null"
                [attr.title]="plans().length > 1 ? plan.reason : null"
              >
                {{ plan.reason }}
              </p>

              <!-- The exercises as lines in a training log; superset members carry their letter -->
              <ul class="mt-3 text-sm">
                @for (ex of plan.exercises; track $index; let x = $index) {
                  @if (supersetLetter(plan.exercises, x) === 'A') {
                    <!-- Names the pair that follows, so the letters explain themselves -->
                    <li class="pt-1.5 text-xs font-semibold text-primary" aria-hidden="true">{{ 'templates.superset' | mnTranslate }}</li>
                  }
                  <li class="flex items-baseline justify-between gap-3 py-0.5">
                    <span class="min-w-0 break-words text-on-surface">
                      @if (supersetLetter(plan.exercises, x); as letter) {
                        <span class="tnum mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded border border-primary px-0.5 align-middle text-[11px] font-bold leading-none text-primary" [attr.title]="'templates.superset' | mnTranslate">{{ letter }}</span>
                        <span class="sr-only">{{ 'templates.superset' | mnTranslate }} </span>
                      }
                      {{ ex.name }}
                    </span>
                    <span class="tnum shrink-0 whitespace-nowrap text-on-surface-variant">{{ target(ex) }}</span>
                  </li>
                }
              </ul>
              @if (hasEstimate(plan)) {
                <p class="mt-1.5 text-xs text-on-surface-variant">{{ 'suggest.estimateHint' | mnTranslate }}</p>
              }

              <div class="mt-auto grid grid-cols-1 gap-2 pt-4">
                <button
                  type="button"
                  (click)="start(plan, i)"
                  [attr.aria-label]="'suggest.startNamed' | mnTranslate: { name: plan.title }"
                  [attr.aria-disabled]="busy() !== null ? 'true' : null"
                  class="flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 font-bold transition-transform active:scale-[0.98]"
                  [class]="week ? saveLook : 'bg-primary text-lg text-on-primary-container'"
                  [class.opacity-70]="busy() !== null"
                >
                  <app-icon [data]="{ name: 'play', size: 18 }" />
                  {{ (busy() === 'start' + i ? 'action.creating' : week ? 'suggest.startNow' : 'suggest.start') | mnTranslate }}
                </button>
                <!-- One element for both states: pressing it must not drop keyboard focus. -->
                @let isSaved = saved().has(i);
                <button
                  type="button"
                  (click)="save([i])"
                  [attr.aria-label]="(isSaved ? 'suggest.savedNamed' : 'suggest.saveNamed') | mnTranslate: { name: plan.title }"
                  [attr.aria-disabled]="isSaved || busy() !== null ? 'true' : null"
                  class="flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 font-bold transition-colors"
                  [class]="isSaved ? savedLook : saveLook"
                  [class.opacity-70]="!isSaved && busy() !== null"
                >
                  <app-icon [data]="{ name: isSaved ? 'check' : 'save', size: 16 }" />
                  {{ (isSaved ? 'suggest.saved' : busy() === 'save' + i ? 'action.saving' : 'suggest.save') | mnTranslate }}
                </button>
              </div>
              @if (!week) {
                <p class="mt-2 text-xs leading-relaxed text-on-surface-variant">{{ 'suggest.templateHint' | mnTranslate }}</p>
              }
            </section>
          }
        </div>

        @if (week && plans().length) {
          <!-- The answer to "plan my week": put it on the calendar. -->
          <div class="mt-4">
            @if (!scheduled()) {
              <app-repeat-weeks-picker class="mb-3" [value]="repeat()" (valueChange)="repeat.set($event)" />
              @if (overlapping().length) {
                <label class="mb-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-surface-container-high px-3 py-2.5 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    class="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                    [checked]="replace()"
                    (change)="replace.set($any($event.target).checked)"
                  />
                  <span>{{ (overlapping().length === 1 ? 'suggest.replace.one' : 'suggest.replace') | mnTranslate: { n: overlapping().length } }}</span>
                </label>
              }
            }
            <button
              type="button"
              (click)="scheduleWeek()"
              [attr.aria-disabled]="scheduled() || busy() !== null ? 'true' : null"
              class="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-4 text-lg font-bold transition-transform active:scale-[0.98] lg:w-auto lg:px-6"
              [class]="scheduled() ? savedLook : 'bg-primary text-on-primary-container'"
              [class.opacity-70]="!scheduled() && busy() !== null"
            >
              <app-icon [data]="{ name: scheduled() ? 'check' : 'calendar-days', size: 18 }" />
              {{ (scheduled() ? 'suggest.scheduled' : busy() === 'schedule' ? 'action.saving' : repeat() > 1 ? 'suggest.scheduleWeeks' : 'suggest.schedule') | mnTranslate: { n: repeat() } }}
            </button>
            <p class="mt-2 px-1 text-xs leading-relaxed text-on-surface-variant">
              {{ 'suggest.scheduleHint' | mnTranslate }}
              @if (repeat() > 1 && !scheduled()) {
                {{ 'schedule.repeat.hint' | mnTranslate }}
              }
            </p>
          </div>
        }
        @if (week && plans().length > 1) {
          <div class="mt-4 lg:flex lg:items-center lg:gap-4">
            <button
              type="button"
              (click)="saveAll()"
              [attr.aria-disabled]="allSaved() || busy() !== null ? 'true' : null"
              class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-3 font-bold transition-colors lg:w-auto lg:shrink-0 lg:px-5"
              [class]="allSaved() ? savedLook : saveLook"
              [class.opacity-70]="!allSaved() && busy() !== null"
            >
              <app-icon [data]="{ name: allSaved() ? 'check' : 'save', size: 16 }" />
              {{ (allSaved() ? 'suggest.savedAll' : busy() === 'saveAll' ? 'action.saving' : 'suggest.saveAll') | mnTranslate }}
            </button>
            <p class="mt-2 text-xs leading-relaxed text-on-surface-variant lg:mt-0">{{ 'suggest.templateHint' | mnTranslate }}</p>
          </div>
        }

        <p class="mt-5 px-1 text-xs leading-relaxed text-on-surface-variant">
          {{ (basedOnHistory() ? 'suggest.disclaimer' : 'suggest.disclaimer.general') | mnTranslate }}
        </p>
        <div class="mt-1 flex flex-wrap gap-x-6 px-1">
          <button
            type="button"
            (click)="load(true)"
            class="flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary"
          >
            <app-icon [data]="{ name: 'rotate-ccw', size: 16 }" />
            {{ (week ? 'suggest.again.week' : 'suggest.again') | mnTranslate }}
          </button>
          <button
            type="button"
            (click)="asking.set(true)"
            class="flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary"
          >
            <app-icon [data]="{ name: week ? 'calendar-days' : 'target', size: 16 }" />
            {{ (week ? 'suggest.days.change' : 'suggest.focus.change') | mnTranslate }}
          </button>
        </div>
      }
    </app-ai-sheet>
  `,
})
export class SuggestSheet implements OnInit {
  private readonly service = inject(AnalysisService);
  private readonly templates = inject(TemplateService);
  private readonly schedule = inject(ScheduleService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input.required<'workout' | 'week'>();
  readonly closed = output<void>();

  readonly dayOptions = [2, 3, 4, 5, 6];
  readonly days = signal(3);
  /** The user's preferred weekdays from Profile (1 = Monday ... 7 = Sunday). */
  readonly preferredDays = signal<number[]>([]);
  /**
   * The questions before a plan: how many days (week mode) and what to focus
   * on. Shown first, unless a plan was already made today.
   */
  readonly asking = signal(false);
  /** What the user asked this plan to focus on. */
  readonly request = signal<PlanRequest>(NO_PLAN_REQUEST);
  /** The ask of the plan on screen, as "Push, short session"; empty when nothing was asked. */
  readonly askedText = signal('');

  readonly loading = signal(false);
  /** The answer on screen; the service keeps the same object, with what was saved from it. */
  private readonly suggestion = signal<Suggestion | null>(null);
  readonly supersetLetter = supersetLetter;

  readonly plans = computed<SuggestedWorkout[]>(() => {
    const s = this.suggestion();
    return s?.days ?? (s?.plan ? [s.plan] : []);
  });
  readonly summary = computed(() => this.suggestion()?.summary ?? '');
  /** False: nothing is logged yet, so this is a general starting plan. */
  readonly basedOnHistory = computed(() => this.suggestion()?.basedOnHistory !== false);
  readonly error = signal<AiError | null>(null);
  readonly showsPlans = computed(() => !this.asking() && !this.loading() && !this.error());

  /** Which button is working ("start0", "save1", "saveAll"), so nothing is pressed twice. */
  readonly busy = signal<string | null>(null);
  /** Indexes of the plans already saved as a template. */
  readonly saved = signal<Set<number>>(new Set());
  readonly allSaved = computed(() => this.plans().every((_, i) => this.saved().has(i)));
  /** How many weeks in a row the week is put on the schedule. */
  readonly repeat = signal(1);
  /** Take the workouts already planned in those weeks off the schedule first. */
  readonly replace = signal(true);
  /** Muscle groups the lifter trains that this week leaves out (checked by the server). */
  readonly uncovered = computed(() => this.suggestion()?.uncovered ?? []);
  /** Planned workouts, not started yet, in the weeks this plan would fill. */
  readonly overlapping = computed(() => {
    const first = this.dates()[0];
    if (!first) return [];
    const last = addDays(first, 7 * this.repeat() - 1);
    const today = todayIso();
    return this.schedule
      .items()
      .filter((i) => !i.workoutId && i.date >= first && i.date <= last && i.date >= today);
  });
  /** The week is on the schedule already. */
  readonly scheduled = signal(false);
  /** Week mode: the date each proposed day goes on, in plan order. */
  readonly dates = computed(() =>
    this.mode() === 'week'
      ? assignDates(this.plans().map((p) => p.weekdayNumber), todayIso(), this.preferredDays())
      : [],
  );

  /** "Save as template": the tinted outline secondary; once saved a calm, readable "Saved". */
  readonly saveLook = 'bg-primary/15 text-primary active:bg-primary/25';
  readonly savedLook = 'cursor-default bg-surface-container text-success';

  readonly loadingSteps = ['suggest.loading.1', 'suggest.loading.2', 'suggest.loading.3'];

  /** What a screen reader hears when the state changes. */
  readonly announce = computed(() => {
    if (this.asking()) return '';
    if (this.loading()) return this.lang.t('suggest.loading');
    const e = this.error();
    if (e) return this.lang.t(e.title);
    return this.suggestion() ? this.lang.t('suggest.ready') : '';
  });

  /** Desktop: the days of a week side by side (2 or 3 columns). */
  readonly gridClass = computed(() => {
    const n = this.plans().length;
    if (n < 2) return '';
    return n === 2 || n === 4 ? 'lg:grid-cols-2' : 'lg:grid-cols-3';
  });

  preferredDaysText(): string {
    return this.preferredDays()
      .map((d) => this.lang.t('profile.day.short.' + d))
      .join(', ');
  }

  ngOnInit(): void {
    const week = this.mode() === 'week';
    // A plan made (or being made) earlier today is shown right away, with what was asked for it.
    const known = this.service.knownPlan(week ? 'week' : 'workout', this.lang.locale);
    if (known && (!week || (known.days != null && this.dayOptions.includes(known.days)))) {
      if (known.days != null) this.days.set(known.days);
      this.request.set(known.request);
      this.load(false);
    } else {
      this.asking.set(true);
    }
    if (!week) return;
    this.schedule.load();
    // Start from the number of days the user said they like to train; the
    // days themselves place a plan on dates when the coach gave none.
    this.service.coachPreferences().subscribe({
      next: (p) => {
        this.preferredDays.set(p.trainingDays);
        const n = p.trainingDays.length;
        if (this.asking() && this.dayOptions.includes(n)) this.days.set(n);
      },
      error: () => undefined,
    });
  }

  load(fresh: boolean): void {
    this.asking.set(false);
    this.loading.set(true);
    this.error.set(null);
    const locale = this.lang.locale;
    const asked = this.request();
    this.askedText.set(
      [asked.focus ? this.lang.t('suggest.focus.' + asked.focus) : '', asked.note.trim()].filter(Boolean).join(', '),
    );
    const request =
      this.mode() === 'week'
        ? this.service.suggestWeek(this.days(), locale, fresh, asked)
        : this.service.suggestWorkout(locale, fresh, undefined, asked);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.suggestion.set(r);
        this.saved.set(new Set(r.savedIndexes ?? []));
        this.scheduled.set(!!r.scheduled);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.suggestion.set(null);
        this.error.set(aiError(err, 'suggest.err.failed', 'suggest.err.failed'));
      },
    });
  }

  /** "Day 1, wed 18 nov": the date the day goes on when the week is scheduled. */
  dayLabel(_plan: SuggestedWorkout, index: number): string {
    const day = this.lang.t('suggest.day', { n: index + 1 });
    const date = this.dates()[index];
    if (!date) return day;
    const text = new Date(`${date}T00:00:00`).toLocaleDateString(this.lang.locale === 'nl' ? 'nl-NL' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `${day}, ${text}`;
  }

  /** "Back, Abs" in the user's language. */
  uncoveredText(): string {
    return this.uncovered()
      .map((g) => this.lang.translateIfPresent('muscle.' + g) ?? g)
      .join(', ');
  }

  /**
   * Puts every day of the week on its date. With "replace" ticked, the
   * workouts already planned in those weeks are taken off first, so the week
   * is not doubled.
   */
  scheduleWeek(): void {
    const suggestion = this.suggestion();
    if (this.busy() || this.scheduled() || !suggestion) return;
    const dates = this.dates();
    this.busy.set('schedule');
    const weeks = this.repeat();
    const old = this.replace() ? this.overlapping() : [];
    const clear: Observable<unknown> = old.length
      ? forkJoin(old.map((i) => this.schedule.remove(i.id)))
      : of(null);
    clear
      .pipe(switchMap(() => this.schedule.create(
        repeatWeeks(this.plans().map((plan, i) => ({
          date: dates[i],
          name: plan.title.trim().slice(0, TEMPLATE_NAME_MAX) || this.lang.t('suggest.title.workout'),
          ...(plan.reason ? { note: plan.reason.slice(0, 255) } : {}),
          exercises: plan.exercises.map((ex) => ({
            exerciseDefinitionId: ex.exerciseDefinitionId,
            targetSets: ex.sets,
            targetReps: ex.reps,
            ...(ex.weightKg != null && ex.weightKg > 0 ? { targetWeightKg: ex.weightKg } : {}),
            ...(ex.supersetGroup != null ? { supersetGroup: ex.supersetGroup } : {}),
          })),
        })), weeks),
      )))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.scheduled.set(true);
          this.service.markScheduled(suggestion);
          this.alerts.success(
            weeks > 1 ? this.lang.t('suggest.toast.scheduledWeeks', { n: weeks }) : this.lang.t('suggest.toast.scheduled'),
            this.lang.t('suggest.toast.scheduled.hint'),
          );
        },
        error: (err) => {
          this.busy.set(null);
          this.alerts.error(this.lang.t('suggest.toast.schedule.err'), this.lang.t(errorHintKey(err)));
        },
      });
  }

  /** "3 × 8 · 70 kg"; bodyweight shows "+10 kg" only when extra weight is suggested. */
  target(ex: SuggestedExercise): string {
    const base = `${ex.sets} × ${ex.reps}`;
    if (ex.weightKg == null || !(ex.weightKg > 0)) return base;
    const kg = `${formatKg(ex.weightKg, this.lang.locale)} ${this.lang.t('unit.kg')}`;
    return `${base} · ${ex.weightEstimated ? '≈ ' : ''}${ex.bodyweight ? '+' : ''}${kg}`;
  }

  /** At least one weight is a starting estimate, so say what the ≈ means. */
  hasEstimate(plan: SuggestedWorkout): boolean {
    return plan.exercises.some((ex) => ex.weightEstimated);
  }

  /** Creates the workout with its targets; the suggested weight travels along as part of the plan. */
  start(plan: SuggestedWorkout, index: number): void {
    if (this.busy()) return;
    this.busy.set('start' + index);
    this.service
      .startPlanned({
        name: plan.title,
        date: todayIso(),
        exercises: plan.exercises.map((ex) => {
          return {
            exerciseDefinitionId: ex.exerciseDefinitionId,
            targetSets: ex.sets,
            targetReps: ex.reps,
            ...(ex.weightKg != null && ex.weightKg > 0 ? { targetWeightKg: ex.weightKg } : {}),
            ...(ex.supersetGroup != null ? { supersetGroup: ex.supersetGroup } : {}),
          };
        }),
      })
      .subscribe({
        next: (created) => {
          // Leave first: the page (and this sheet with it) goes away with the
          // navigation, so the sheet is never closed while it is being checked.
          void this.router.navigate(['/workouts', created.id]).then((moved) => {
            if (moved) return;
            this.busy.set(null);
            this.closed.emit();
          });
        },
        error: (err) => {
          this.busy.set(null);
          this.alerts.error(this.lang.t('templates.toast.start.err'), this.lang.t(errorHintKey(err)));
        },
      });
  }

  saveAll(): void {
    this.save(this.plans().map((_, i) => i));
  }

  /**
   * Saves the given proposals as templates, one after the other. A name that
   * is already taken gets a number ("Push day 2"), and the toast says which
   * name it became.
   */
  save(indexes: number[]): void {
    const suggestion = this.suggestion();
    const todo = indexes.filter((i) => !this.saved().has(i));
    if (this.busy() || !suggestion || !todo.length) return;
    this.busy.set(indexes.length > 1 ? 'saveAll' : 'save' + todo[0]);
    const plans = this.plans();
    const names: string[] = [];

    this.templates
      .getAll()
      .pipe(
        switchMap((existing) => {
          const taken = new Set(existing.map((t) => t.name.trim().toLowerCase()));
          return from(todo).pipe(
            concatMap((i) => {
              const name = this.freeName(plans[i].title, taken);
              taken.add(name.toLowerCase());
              return this.templates
                .create({
                  name,
                  exercises: plans[i].exercises.map((ex) => ({
                    exerciseDefinitionId: ex.exerciseDefinitionId,
                    targetSets: ex.sets,
                    targetReps: ex.reps,
                    supersetGroup: ex.supersetGroup ?? null,
                  })),
                })
                .pipe(
                  tap(() => {
                    names.push(name);
                    this.service.markSaved(suggestion, i);
                    this.saved.update((s) => new Set(s).add(i));
                  }),
                  map(() => name),
                );
            }),
            toArray(),
          );
        }),
      )
      .subscribe({
        next: () => {
          this.busy.set(null);
          const title =
            names.length === 1
              ? this.lang.t('templates.toast.created')
              : this.lang.t('suggest.toast.savedAll', { n: names.length });
          this.alerts.success(title, names.join(', '));
        },
        error: (err) => {
          this.busy.set(null);
          this.alerts.error(this.lang.t('templates.toast.save.err'), this.lang.t(errorHintKey(err)));
        },
      });
  }

  /** `title`, or "title 2", "title 3"... when a template with that name exists. */
  private freeName(title: string, taken: Set<string>): string {
    const base = title.trim().slice(0, TEMPLATE_NAME_MAX) || this.lang.t('suggest.title.workout');
    if (!taken.has(base.toLowerCase())) return base;
    for (let n = 2; ; n++) {
      const suffix = ` ${n}`;
      const name = base.slice(0, TEMPLATE_NAME_MAX - suffix.length).trimEnd() + suffix;
      if (!taken.has(name.toLowerCase())) return name;
    }
  }
}
