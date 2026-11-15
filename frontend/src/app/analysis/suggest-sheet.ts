import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MnAlertService, MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { concatMap, from, map, switchMap, tap, toArray } from 'rxjs';
import { supersetLetter } from '../shared/superset';
import { AppIcon } from '../shared/app-icon';
import { errorHintKey, formatKg, todayIso } from '../shared/format';
import { TemplateService } from '../templates/data-access/template.service';
import { AiError, aiError } from './ai-error';
import { AiSheet } from './ai-sheet';
import { AiErrorBox, AiLoading } from './ai-states';
import { AnalysisService, SuggestedExercise, SuggestedWorkout, Suggestion } from './analysis.service';

/** Longest template name the server accepts. */
const TEMPLATE_NAME_MAX = 100;

/**
 * Sheet that asks Claude for a plan and lets the user act on it: the next
 * workout (`mode="workout"`, asked right away) or a whole week (`mode="week"`,
 * after choosing the number of training days). Each proposed workout can be
 * started as a workout with targets or saved as a template.
 *
 *   @if (suggestMode(); as mode) {
 *     <app-suggest-sheet [mode]="mode" (closed)="suggestMode.set(null)" />
 *   }
 */
@Component({
  selector: 'app-suggest-sheet',
  standalone: true,
  imports: [AppIcon, AiSheet, AiLoading, AiErrorBox, MnTranslatePipe],
  template: `
    @let week = mode() === 'week';
    <app-ai-sheet
      [title]="(week ? 'suggest.title.week' : 'suggest.title.workout') | mnTranslate"
      [announce]="announce()"
      [wide]="week && showsPlans() && plans().length > 1"
      (closed)="closed.emit()"
    >
      @if (choosingDays()) {
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
        <button
          type="button"
          (click)="load(false)"
          class="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-lg font-bold text-on-primary-container transition-transform active:scale-[0.98]"
        >
          {{ 'suggest.days.go' | mnTranslate }}
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
        @if (summary(); as text) {
          <p class="mb-4 hyphens-auto px-1 leading-relaxed text-on-surface-variant">{{ text }}</p>
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

              <div class="mt-auto grid grid-cols-1 gap-2 pt-4">
                <button
                  type="button"
                  (click)="start(plan, i)"
                  [attr.aria-label]="'suggest.startNamed' | mnTranslate: { name: plan.title }"
                  [attr.aria-disabled]="busy() !== null ? 'true' : null"
                  class="flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3 text-lg font-bold text-on-primary-container transition-transform active:scale-[0.98]"
                  [class.opacity-70]="busy() !== null"
                >
                  <app-icon [data]="{ name: 'play', size: 18 }" />
                  {{ (busy() === 'start' + i ? 'action.creating' : 'suggest.start') | mnTranslate }}
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
          @if (week) {
            <button
              type="button"
              (click)="choosingDays.set(true)"
              class="flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary"
            >
              <app-icon [data]="{ name: 'calendar-days', size: 16 }" />
              {{ 'suggest.days.change' | mnTranslate }}
            </button>
          }
        </div>
      }
    </app-ai-sheet>
  `,
})
export class SuggestSheet implements OnInit {
  private readonly service = inject(AnalysisService);
  private readonly templates = inject(TemplateService);
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
  /** Week mode starts with the question how many days to train. */
  readonly choosingDays = signal(false);

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
  readonly showsPlans = computed(() => !this.choosingDays() && !this.loading() && !this.error());

  /** Which button is working ("start0", "save1", "saveAll"), so nothing is pressed twice. */
  readonly busy = signal<string | null>(null);
  /** Indexes of the plans already saved as a template. */
  readonly saved = signal<Set<number>>(new Set());
  readonly allSaved = computed(() => this.plans().every((_, i) => this.saved().has(i)));

  /** "Save as template": the tinted outline secondary; once saved a calm, readable "Saved". */
  readonly saveLook = 'bg-primary/15 text-primary active:bg-primary/25';
  readonly savedLook = 'cursor-default bg-surface-container text-success';

  readonly loadingSteps = ['suggest.loading.1', 'suggest.loading.2', 'suggest.loading.3'];

  /** What a screen reader hears when the state changes. */
  readonly announce = computed(() => {
    if (this.choosingDays()) return '';
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
    if (this.mode() !== 'week') {
      this.load(false);
      return;
    }
    // A weekly plan made (or being made) earlier today is shown right away.
    const known = this.service.knownWeekDays(this.lang.locale);
    if (known && this.dayOptions.includes(known)) {
      this.days.set(known);
      this.load(false);
    } else {
      this.choosingDays.set(true);
      // Start from the number of days the user said they like to train.
      this.service.coachPreferences().subscribe({
        next: (p) => {
          this.preferredDays.set(p.trainingDays);
          const n = p.trainingDays.length;
          if (this.choosingDays() && this.dayOptions.includes(n)) this.days.set(n);
        },
        error: () => undefined,
      });
    }
  }

  load(fresh: boolean): void {
    this.choosingDays.set(false);
    this.loading.set(true);
    this.error.set(null);
    const locale = this.lang.locale;
    const request =
      this.mode() === 'week'
        ? this.service.suggestWeek(this.days(), locale, fresh)
        : this.service.suggestWorkout(locale, fresh);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.suggestion.set(r);
        this.saved.set(new Set(r.savedIndexes ?? []));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.suggestion.set(null);
        this.error.set(aiError(err, 'suggest.err.failed', 'suggest.err.failed'));
      },
    });
  }

  /** "Day 1 · Monday": the weekday is Claude's proposal and can be missing. */
  dayLabel(plan: SuggestedWorkout, index: number): string {
    const day = this.lang.t('suggest.day', { n: index + 1 });
    const weekday = plan.weekday?.trim();
    return weekday ? `${day}, ${weekday.toLowerCase()}` : day;
  }

  /** "3 × 8 · 70 kg"; bodyweight shows "+10 kg" only when extra weight is suggested. */
  target(ex: SuggestedExercise): string {
    const base = `${ex.sets} × ${ex.reps}`;
    if (ex.weightKg == null || !(ex.weightKg > 0)) return base;
    const kg = `${formatKg(ex.weightKg, this.lang.locale)} ${this.lang.t('unit.kg')}`;
    return `${base} · ${ex.bodyweight ? '+' : ''}${kg}`;
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
