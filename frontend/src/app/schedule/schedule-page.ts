import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppHeader } from '../layout/app-header';
import { AppIcon } from '../shared/app-icon';
import { plural, todayIso } from '../shared/format';
import { WorkoutService } from '../workouts/data-access/workout.service';
import { Workout, workoutSetCount } from '../workouts/models/workout.model';
import { ScheduleService } from './schedule.service';
import { ScheduleStatus, ScheduledWorkout, scheduleStatus } from './schedule.model';
import { addDays, weekdayOf } from './schedule-dates';
import { statusKey } from './schedule-format';
import { ScheduledSheet } from './scheduled-sheet';
import { PlanTemplateSheet } from './plan-template-sheet';

interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  plans: { item: ScheduledWorkout; status: ScheduleStatus }[];
  /** Workouts with at least one logged set. */
  trained: Workout[];
}

/** First day (yyyy-mm-01) of the month that contains `date`. */
function monthOf(date: string): string {
  return date.slice(0, 8) + '01';
}

/** "maandag 16 november" -> "Maandag 16 november" (CSS capitalize would do every word). */
function firstUpper(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shiftMonth(month: string, n: number): string {
  const d = new Date(`${month}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The schedule as a month: every day shows what is planned and what was
 * trained. Tapping a day lists it below, where a plan can be opened (start,
 * move, remove) or a workout put on that day.
 */
@Component({
  selector: 'app-schedule-page',
  standalone: true,
  imports: [AppHeader, AppIcon, RouterLink, MnSkeleton, MnTranslatePipe, ScheduledSheet, PlanTemplateSheet],
  template: `
    <app-header [title]="'calendar.title' | mnTranslate" [showBack]="false" />

    <main class="mx-auto max-w-2xl px-4 pb-28 pt-20">
      <!-- Month and the way through it -->
      <div class="mb-3 flex items-center gap-2">
        <button
          type="button"
          (click)="go(-1)"
          [attr.aria-label]="'calendar.prev' | mnTranslate"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/50"
        >
          <app-icon [data]="{ name: 'chevron-left', size: 22 }" />
        </button>
        <h2 class="min-w-0 flex-1 text-center font-display text-xl font-bold text-on-surface" aria-live="polite">
          {{ monthLabel() }}
        </h2>
        <button
          type="button"
          (click)="go(1)"
          [attr.aria-label]="'calendar.next' | mnTranslate"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/50"
        >
          <app-icon [data]="{ name: 'chevron-right', size: 22 }" />
        </button>
      </div>
      @if (month() !== thisMonth) {
        <div class="-mt-2 mb-2 text-center">
          <button type="button" (click)="goToday()" class="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
            {{ 'calendar.today' | mnTranslate }}
          </button>
        </div>
      }

      @if (loading() && !days().length) {
        <mn-skeleton [data]="{ shape: 'rectangle', height: '320px' }" class="rounded-2xl" />
      } @else {
        <div class="glass-card rounded-2xl p-2 sm:p-3">
          <div class="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-on-surface-variant" aria-hidden="true">
            @for (w of [1, 2, 3, 4, 5, 6, 7]; track w) {
              <span class="py-1">{{ ('profile.day.short.' + w) | mnTranslate }}</span>
            }
          </div>
          <div class="grid grid-cols-7 gap-1" role="grid" [attr.aria-label]="monthLabel()">
            @for (d of days(); track d.date) {
              <button
                type="button"
                role="gridcell"
                (click)="selected.set(d.date)"
                [attr.aria-label]="dayAria(d)"
                [attr.aria-selected]="d.selected"
                class="flex min-h-14 min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 transition-colors sm:min-h-20"
                [class]="d.selected ? 'bg-primary/15' : 'hover:bg-surface-variant/40'"
                [class.opacity-40]="!d.inMonth"
              >
                <span
                  class="tnum flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  [class]="d.today ? 'bg-primary font-bold text-on-primary-container' : d.selected ? 'font-bold text-primary' : 'text-on-surface'"
                >
                  {{ d.day }}
                </span>
                <!-- Markers: filled = trained, ring = planned, dashed = missed -->
                <span class="flex flex-wrap items-center justify-center gap-0.5" aria-hidden="true">
                  @for (t of d.trained.slice(0, 2); track t.id) {
                    <span class="h-2 w-2 rounded-full bg-primary"></span>
                  }
                  @for (p of d.plans.slice(0, 2); track p.item.id) {
                    @if (p.status === 'missed') {
                      <span class="h-2 w-2 rounded-full border border-dashed border-outline"></span>
                    } @else if (p.status === 'today' || p.status === 'upcoming') {
                      <span class="h-2 w-2 rounded-full border-2 border-primary"></span>
                    }
                  }
                </span>
                <!-- Wide screens have room for the name -->
                @if (d.plans.length || d.trained.length) {
                  <span class="hidden w-full truncate px-1 text-[11px] leading-tight text-on-surface-variant sm:block">{{ firstName(d) }}</span>
                }
              </button>
            }
          </div>
          <p class="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-primary"></span>{{ 'calendar.legend.trained' | mnTranslate }}</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full border-2 border-primary"></span>{{ 'calendar.legend.planned' | mnTranslate }}</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full border border-dashed border-outline"></span>{{ 'calendar.legend.missed' | mnTranslate }}</span>
          </p>
        </div>

        <!-- The chosen day -->
        @if (selectedDay(); as d) {
          <section class="mt-6" aria-labelledby="calendar-day-title">
            <h2 id="calendar-day-title" class="mb-2 px-1 font-display text-lg font-bold text-on-surface">{{ longDay(d.date) }}</h2>
            <ul class="space-y-2">
              @for (p of d.plans; track p.item.id) {
                <li>
                  <button
                    type="button"
                    (click)="openPlan.set(p)"
                    class="glass-card flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors active:bg-surface-variant/30"
                  >
                    <span class="shrink-0" [class]="p.status === 'missed' ? 'text-on-surface-variant' : 'text-primary'">
                      <app-icon [data]="{ name: p.status === 'done' ? 'check' : 'calendar-days', size: 20 }" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-bold text-on-surface">{{ p.item.name }}</span>
                      <span class="block text-xs text-on-surface-variant">
                        {{ statusKey(p.status) | mnTranslate }} · {{ count('schedule.plan.exercises', p.item.exercises.length) }}
                      </span>
                    </span>
                    <span class="shrink-0 text-outline"><app-icon [data]="{ name: 'chevron-right', size: 18 }" /></span>
                  </button>
                </li>
              }
              @for (w of trainedOnly(d); track w.id) {
                <li>
                  <a
                    [routerLink]="['/workouts', w.id]"
                    class="glass-card flex min-h-14 items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors active:bg-surface-variant/30"
                  >
                    <span class="shrink-0 text-primary"><app-icon [data]="{ name: 'check', size: 20 }" /></span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-bold text-on-surface">{{ w.name }}</span>
                      <span class="block text-xs text-on-surface-variant">{{ count('calendar.sets', setCount(w)) }}</span>
                    </span>
                    <span class="shrink-0 text-outline"><app-icon [data]="{ name: 'chevron-right', size: 18 }" /></span>
                  </a>
                </li>
              }
              @if (!d.plans.length && !d.trained.length) {
                <li class="glass-card rounded-2xl px-4 py-3.5 text-sm text-on-surface-variant">{{ 'calendar.empty' | mnTranslate }}</li>
              }
            </ul>
            <button
              type="button"
              (click)="planning.set(d.date)"
              class="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary/15 px-4 font-bold text-primary transition-colors active:bg-primary/25"
            >
              <app-icon [data]="{ name: 'plus', size: 18 }" />
              {{ 'calendar.planHere' | mnTranslate }}
            </button>
          </section>
        }
      }
    </main>

    @if (openPlan(); as p) {
      <app-scheduled-sheet [item]="p.item" [status]="p.status" (closed)="afterChange(); openPlan.set(null)" />
    }
    @if (planning(); as day) {
      <app-plan-template-sheet [initialDate]="day" (closed)="afterChange(); planning.set(null)" (planWeek)="planWeek()" />
    }
  `,
})
export class SchedulePage implements OnInit {
  private readonly schedule = inject(ScheduleService);
  private readonly workoutsApi = inject(WorkoutService);
  private readonly lang = inject(MnLanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly today = todayIso();
  readonly thisMonth = monthOf(this.today);
  readonly month = signal(this.thisMonth);
  readonly selected = signal(this.today);
  readonly plans = signal<ScheduledWorkout[]>([]);
  readonly workouts = signal<Workout[]>([]);
  readonly loading = signal(true);
  readonly openPlan = signal<{ item: ScheduledWorkout; status: ScheduleStatus } | null>(null);
  /** The day the Schedule sheet is open for. */
  readonly planning = signal<string | null>(null);

  readonly statusKey = statusKey;
  readonly setCount = workoutSetCount;

  /** Monday on or before the 1st, six weeks long. */
  private readonly gridStart = computed(() => {
    const first = this.month();
    return addDays(first, -(weekdayOf(first) - 1));
  });

  private readonly trainedByDate = computed(() => {
    const map = new Map<string, Workout[]>();
    for (const w of this.workouts()) {
      if (workoutSetCount(w) <= 0) continue;
      const day = String(w.date).slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), w]);
    }
    return map;
  });

  readonly days = computed<CalendarDay[]>(() => {
    const start = this.gridStart();
    const month = this.month().slice(0, 7);
    const trained = this.trainedByDate();
    const trainedDates = new Set(trained.keys());
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(start, i);
      return {
        date,
        day: Number(date.slice(8, 10)),
        inMonth: date.slice(0, 7) === month,
        today: date === this.today,
        selected: date === this.selected(),
        plans: this.plans()
          .filter((p) => p.date === date)
          .map((item) => ({ item, status: scheduleStatus(item, this.today, trainedDates) })),
        trained: trained.get(date) ?? [],
      };
    });
  });

  readonly selectedDay = computed(() => this.days().find((d) => d.selected) ?? null);

  ngOnInit(): void {
    // Opened from a day on Home: start on that day.
    const day = this.route.snapshot.queryParamMap.get('day');
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      this.selected.set(day);
      this.month.set(monthOf(day));
    }
    this.workoutsApi.getWorkouts().subscribe({
      next: (list) => this.workouts.set(list),
      error: () => undefined,
    });
    this.loadMonth();
  }

  go(n: number): void {
    const next = shiftMonth(this.month(), n);
    this.month.set(next);
    this.selected.set(monthOf(this.today) === next ? this.today : next);
    this.loadMonth();
  }

  goToday(): void {
    this.month.set(this.thisMonth);
    this.selected.set(this.today);
    this.loadMonth();
  }

  /** A sheet may have started, moved or added something: show it, here and on Home. */
  afterChange(): void {
    this.loadMonth();
    this.schedule.load();
  }

  /** The coach's week opens on Home, where it is planned from. */
  planWeek(): void {
    this.planning.set(null);
    void this.router.navigate(['/workouts'], { queryParams: { coach: 'week' } });
  }

  // Plain methods: they must follow a language switch.
  monthLabel(): string {
    return firstUpper(new Date(`${this.month()}T00:00:00`).toLocaleDateString(this.locale(), { month: 'long', year: 'numeric' }));
  }

  longDay(date: string): string {
    return firstUpper(new Date(`${date}T00:00:00`).toLocaleDateString(this.locale(), { weekday: 'long', day: 'numeric', month: 'long' }));
  }

  firstName(d: CalendarDay): string {
    return d.plans[0]?.item.name ?? d.trained[0]?.name ?? '';
  }

  trainedOnly(d: CalendarDay): Workout[] {
    // A workout started from a plan is already shown as that plan.
    const linked = new Set(d.plans.map((p) => p.item.workoutId).filter(Boolean));
    return d.trained.filter((w) => !linked.has(w.id));
  }

  count(key: string, n: number): string {
    return this.lang.t(plural(n, key), { n });
  }

  dayAria(d: CalendarDay): string {
    const parts = [this.longDay(d.date)];
    for (const w of d.trained) parts.push(this.lang.t('calendar.aria.trained', { name: w.name }));
    for (const p of d.plans) {
      if (p.status !== 'done') parts.push(`${p.item.name}, ${this.lang.t(statusKey(p.status))}`);
    }
    return parts.join('. ');
  }

  private locale(): string {
    return this.lang.locale === 'nl' ? 'nl-NL' : 'en-GB';
  }

  private loadMonth(): void {
    const from = this.gridStart();
    this.loading.set(true);
    this.schedule.range(from, addDays(from, 41)).subscribe({
      next: (list) => {
        this.plans.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
