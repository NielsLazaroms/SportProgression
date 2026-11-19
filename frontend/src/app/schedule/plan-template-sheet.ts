import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  MnAlertService,
  MnBottomSheet,
  MnButton,
  MnInputField,
  MnLanguageService,
  MnTranslatePipe,
} from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';
import { errorHintKey, todayIso } from '../shared/format';
import { TemplateService } from '../templates/data-access/template.service';
import { WorkoutTemplate } from '../templates/models/template.model';
import { ScheduleService } from './schedule.service';
import { AuthService } from '../auth/data-access/auth.service';
import { AnalysisService, NO_PLAN_REQUEST, PlanRequest } from '../analysis/analysis.service';
import { PlanFocusPicker } from '../analysis/plan-focus-picker';
import { aiError } from '../analysis/ai-error';
import { scheduleDay } from './schedule-format';
import { ScheduleItem, repeatWeeks } from './schedule.model';
import { RepeatWeeksPicker } from './repeat-weeks-picker';

/** The choice that lets the coach write the workout instead of using a template. */
const COACH = 'coach';

/**
 * Puts a workout on a day of the user's choosing: one of the templates, or
 * (with the AI role) one the coach writes for it, or the whole week planned
 * by the coach.
 */
@Component({
  selector: 'app-plan-template-sheet',
  standalone: true,
  imports: [FormsModule, RouterLink, MnBottomSheet, MnButton, MnInputField, MnTranslatePipe, AppIcon, RepeatWeeksPicker, PlanFocusPicker],
  template: `
    <mn-bottom-sheet [maxHeightVh]="90" [ariaLabel]="'schedule.plan.title' | mnTranslate" (dismiss)="closed.emit()">
      <div class="mx-auto max-h-[80dvh] w-full max-w-xl overflow-y-auto overscroll-contain px-5 pt-2">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="min-w-0 font-display text-xl font-bold text-on-surface">{{ 'schedule.plan.title' | mnTranslate }}</h2>
          <button
            type="button"
            (click)="closed.emit()"
            [attr.aria-label]="'action.close' | mnTranslate"
            class="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/50"
          >
            <app-icon [data]="{ name: 'x', size: 22 }" />
          </button>
        </div>

        @if (!loaded()) {
          <p class="py-6 text-sm text-on-surface-variant">{{ 'schedule.plan.loading' | mnTranslate }}</p>
        } @else if (!usable().length && !canUseAi()) {
          <div class="mb-5 rounded-2xl bg-surface-container-high p-4 text-sm text-on-surface-variant">
            <p>{{ 'schedule.plan.noTemplates' | mnTranslate }}</p>
            <a routerLink="/templates/new" (click)="closed.emit()" class="mt-2 inline-flex min-h-11 items-center font-semibold text-primary">
              {{ 'schedule.plan.makeTemplate' | mnTranslate }}
            </a>
          </div>
        } @else {
          <p id="plan-template-label" class="mb-2 text-sm font-semibold text-on-surface-variant">{{ 'schedule.plan.what' | mnTranslate }}</p>
          <ul role="radiogroup" aria-labelledby="plan-template-label" class="mb-2 space-y-2">
            @if (showCoach()) {
              <li>
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="chosenId() === coach"
                  (click)="chosenId.set(coach)"
                  class="flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left transition-colors"
                  [class]="chosenId() === coach ? 'border-primary bg-primary/10' : 'border-outline-variant/40'"
                >
                  <span class="shrink-0 text-primary"><app-icon [data]="{ name: 'sparkles', size: 18 }" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block font-bold text-on-surface">{{ 'schedule.plan.coach' | mnTranslate }}</span>
                    <span class="block text-xs text-on-surface-variant">{{ 'schedule.plan.coach.hint' | mnTranslate }}</span>
                  </span>
                  @if (chosenId() === coach) {
                    <span class="text-primary"><app-icon [data]="{ name: 'check', size: 18 }" /></span>
                  }
                </button>
              </li>
            }
            @for (t of usable(); track t.id) {
              <li>
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="chosenId() === t.id"
                  (click)="chosenId.set(t.id)"
                  class="flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left transition-colors"
                  [class]="chosenId() === t.id ? 'border-primary bg-primary/10' : 'border-outline-variant/40'"
                >
                  <span class="min-w-0 flex-1">
                    <span class="block font-bold text-on-surface [overflow-wrap:anywhere]">{{ t.name }}</span>
                    <span class="block text-xs text-on-surface-variant">{{ count(t) }}</span>
                  </span>
                  @if (chosenId() === t.id) {
                    <span class="text-primary"><app-icon [data]="{ name: 'check', size: 18 }" /></span>
                  }
                </button>
              </li>
            }
          </ul>
          @if (chosenId() === coach) {
            <!-- What the coach's workout should focus on -->
            <app-plan-focus-picker
              idPrefix="plan-day"
              class="mb-2 mt-3 rounded-xl bg-surface-container p-3"
              [value]="request()"
              (valueChange)="request.set($event)"
            />
          }
          @if (showCoach()) {
            <button type="button" (click)="planWeek.emit()" class="mb-4 inline-flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-primary">
              <app-icon [data]="{ name: 'calendar-days', size: 16 }" />
              {{ 'schedule.plan.week' | mnTranslate }}
            </button>
          } @else {
            <div class="mb-3"></div>
          }

          <mn-lib-input-field
            [props]="{ id: 'plan-date', type: 'date', label: ('schedule.plan.date' | mnTranslate), fullWidth: true }"
            [ngModel]="date()"
            (ngModelChange)="date.set($event ?? '')"
            [ngModelOptions]="{ standalone: true }"
          />
          @if (date() && date() < today) {
            <p class="mt-1 px-1 text-xs text-on-surface-variant">{{ 'schedule.plan.past' | mnTranslate }}</p>
          }
          <app-repeat-weeks-picker class="mt-4" [value]="repeat()" (valueChange)="repeat.set($event)" />
          @if (repeat() > 1) {
            <p class="mt-1.5 px-1 text-xs text-on-surface-variant">{{ 'schedule.repeat.everyWeek' | mnTranslate: { day: weekday(), n: repeat() } }}</p>
          }

          <div class="flex gap-3 pb-5 pt-5">
            <button mnButton type="button" [data]="{ color: 'gray', size: 'lg', wrap: true }" class="min-w-0 flex-1" (click)="closed.emit()">
              {{ 'action.cancel' | mnTranslate }}
            </button>
            <button
              mnButton
              type="button"
              [data]="{ color: 'primary', size: 'lg', wrap: true, disabled: !canSave() || saving() }"
              class="min-w-0 flex-1"
              (click)="save()"
            >
              {{ (saving() ? (chosenId() === coach ? 'schedule.plan.coach.busy' : 'action.saving') : 'schedule.plan.go') | mnTranslate }}
            </button>
          </div>
          @if (saving() && chosenId() === coach) {
            <p class="-mt-3 pb-5 text-xs text-on-surface-variant" aria-live="polite">{{ 'schedule.plan.coach.wait' | mnTranslate }}</p>
          }
        }
      </div>
    </mn-bottom-sheet>
  `,
})
export class PlanTemplateSheet implements OnInit {
  private readonly templatesApi = inject(TemplateService);
  private readonly schedule = inject(ScheduleService);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);
  private readonly analysis = inject(AnalysisService);
  readonly canUseAi = inject(AuthService).canUseAi;

  /** Start with this template chosen (from the Templates page). */
  readonly template = input<WorkoutTemplate | null>(null);
  /** The day to start with (a day tapped in the calendar); today otherwise. */
  readonly initialDate = input<string | null>(null);
  readonly closed = output<void>();
  /** "Let the coach plan the whole week" was chosen instead. */
  readonly planWeek = output<void>();
  readonly coach = COACH;

  readonly today = todayIso();
  readonly templates = signal<WorkoutTemplate[]>([]);
  readonly loaded = signal(false);
  readonly chosenId = signal<string | null>(null);
  /** What the coach's workout should focus on, when the coach writes it. */
  readonly request = signal<PlanRequest>(NO_PLAN_REQUEST);
  readonly date = signal(todayIso());
  readonly saving = signal(false);
  /** The same day every week, for this many weeks. */
  readonly repeat = signal(1);

  /** Only templates with exercises can become a workout. */
  readonly usable = computed(() =>
    this.templates().filter((t) => t.exercises.some((e) => e.exerciseDefinitionId != null)),
  );
  /** The coach is offered when nothing was picked beforehand (not from a template's card). */
  readonly showCoach = computed(() => this.canUseAi() && !this.template());
  readonly canSave = computed(() => !!this.chosenId() && /^\d{4}-\d{2}-\d{2}$/.test(this.date()));

  ngOnInit(): void {
    const day = this.initialDate();
    if (day) this.date.set(day);
    const given = this.template();
    if (given) {
      this.templates.set([given]);
      this.chosenId.set(given.id);
      this.loaded.set(true);
      return;
    }
    this.templatesApi.getAll().subscribe({
      next: (list) => {
        this.templates.set(list);
        const first = this.usable()[0];
        if (first) this.chosenId.set(first.id);
        else if (this.showCoach()) this.chosenId.set(COACH);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  /** "Thursday" for the chosen date. */
  weekday(): string {
    const d = this.date();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    return new Date(`${d}T00:00:00`).toLocaleDateString(this.lang.locale === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'long' });
  }

  /** Puts the item (and its repeats) on the schedule and says where it went. */
  private put(item: ScheduleItem): void {
    const weeks = this.repeat();
    const day = scheduleDay(item.date, this.today, this.lang);
    this.schedule.create(repeatWeeks([item], weeks)).subscribe({
      next: () => {
        this.saving.set(false);
        this.alerts.success(
          weeks > 1
            ? this.lang.t('schedule.toast.plannedWeeks', { name: item.name, day, n: weeks })
            : this.lang.t('schedule.toast.planned', { name: item.name, day }),
        );
        this.closed.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.alerts.error(this.lang.t('schedule.toast.plan.err'), this.lang.t(errorHintKey(err)));
      },
    });
  }

  count(t: WorkoutTemplate): string {
    const n = t.exercises.length;
    return this.lang.t(n === 1 ? 'schedule.plan.exercises.one' : 'schedule.plan.exercises', { n });
  }

  save(): void {
    if (this.chosenId() === COACH) {
      this.saveFromCoach();
      return;
    }
    const t = this.usable().find((x) => x.id === this.chosenId());
    if (!t || !this.canSave() || this.saving()) return;
    const date = this.date();
    this.saving.set(true);
    this.put({
      date,
      name: t.name,
      exercises: [...t.exercises]
        .sort((a, b) => a.orderInTemplate - b.orderInTemplate)
        .filter((e) => e.exerciseDefinitionId != null)
        .map((e) => ({
          exerciseDefinitionId: e.exerciseDefinitionId!,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          ...(e.supersetGroup != null ? { supersetGroup: e.supersetGroup } : {}),
        })),
    });
  }

  /** Asks the coach for a workout for that day (kept for the rest of today) and puts it on the day. */
  private saveFromCoach(): void {
    if (!this.canSave() || this.saving()) return;
    const date = this.date();
    this.saving.set(true);
    this.analysis.suggestWorkout(this.lang.locale, false, date, this.request()).subscribe({
      next: (s) => {
        const plan = s.plan;
        if (!plan?.exercises.length) {
          this.saving.set(false);
          this.alerts.error(this.lang.t('schedule.toast.plan.err'));
          return;
        }
        const name = plan.title.trim().slice(0, 100) || this.lang.t('suggest.title.workout');
        this.put({
          date,
          name,
          ...(plan.reason ? { note: plan.reason.slice(0, 255) } : {}),
          exercises: plan.exercises.map((ex) => ({
            exerciseDefinitionId: ex.exerciseDefinitionId,
            targetSets: ex.sets,
            targetReps: ex.reps,
            ...(ex.weightKg != null && ex.weightKg > 0 ? { targetWeightKg: ex.weightKg } : {}),
            ...(ex.supersetGroup != null ? { supersetGroup: ex.supersetGroup } : {}),
          })),
        });
      },
      error: (err) => {
        this.saving.set(false);
        const e = aiError(err, 'suggest.err.failed', 'suggest.err.failed');
        this.alerts.error(this.lang.t(e.title));
      },
    });
  }
}
