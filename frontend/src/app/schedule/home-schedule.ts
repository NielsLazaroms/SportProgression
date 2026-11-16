import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MnLanguageService, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../shared/app-icon';
import { todayIso } from '../shared/format';
import { ScheduleService } from './schedule.service';
import { ScheduleStatus, ScheduledWorkout, scheduleStatus } from './schedule.model';
import { scheduleDay, statusKey } from './schedule-format';
import { PlanTemplateSheet } from './plan-template-sheet';

/** Rows shown before "show all". */
const PREVIEW = 4;

/**
 * Home's "Scheduled" list: missed plans first (with the way to move them),
 * then today and what is coming. "Schedule" puts a template on a day.
 */
@Component({
  selector: 'app-home-schedule',
  standalone: true,
  imports: [AppIcon, MnTranslatePipe, PlanTemplateSheet],
  host: { class: 'block' },
  template: `
    <section class="mb-8" aria-labelledby="home-schedule-title">
      <div class="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 id="home-schedule-title" class="min-w-0 text-sm font-semibold text-on-surface-variant">{{ 'schedule.title' | mnTranslate }}</h2>
        <button type="button" (click)="planning.set(true)" class="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary">
          <app-icon [data]="{ name: 'plus', size: 16 }" />
          {{ 'schedule.plan.button' | mnTranslate }}
        </button>
      </div>

      @if (rows().length) {
        <!-- One list, like an agenda: the date once on the left, then what and how it stands -->
        <ul class="glass-card divide-y divide-outline-variant/25 overflow-hidden rounded-2xl">
          @for (r of shown(); track r.item.id) {
            <li>
              <button
                type="button"
                (click)="open.emit({ item: r.item, status: r.status })"
                [attr.aria-label]="ariaFor(r.item, r.status)"
                class="flex min-h-16 w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-surface-variant/30"
              >
                <span
                  class="flex w-9 shrink-0 flex-col items-center leading-none"
                  [class]="r.status === 'today' ? 'text-primary' : 'text-on-surface-variant'"
                  aria-hidden="true"
                >
                  <span class="text-xs font-semibold">{{ weekday(r.item.date) }}</span>
                  <span class="tnum mt-1 font-display text-xl font-bold" [class.text-on-surface]="r.status === 'upcoming'">{{ dayOfMonth(r.item.date) }}</span>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-bold text-on-surface">{{ r.item.name }}</span>
                  <span
                    class="mt-0.5 block text-sm"
                    [class]="r.status === 'today' ? 'font-semibold text-primary' : 'text-on-surface-variant'"
                  >
                    {{ subtitle(r.item, r.status) }}
                  </span>
                </span>
                <span class="shrink-0 text-outline" aria-hidden="true"><app-icon [data]="{ name: 'chevron-right', size: 18 }" /></span>
              </button>
            </li>
          }
        </ul>
        @if (rows().length > preview) {
          <button
            type="button"
            (click)="showAll.update((v) => !v)"
            [attr.aria-expanded]="showAll()"
            class="mt-1 inline-flex min-h-11 items-center px-1 text-sm font-semibold text-primary"
          >
            {{ (showAll() ? 'schedule.less' : 'schedule.all') | mnTranslate: { n: rows().length } }}
          </button>
        }
      } @else if (schedule.loaded()) {
        <p class="glass-card rounded-2xl px-4 py-3.5 text-sm leading-relaxed text-on-surface-variant">{{ 'schedule.empty' | mnTranslate }}</p>
      }
    </section>

    @if (planning()) {
      <app-plan-template-sheet (closed)="planning.set(false)" (planWeek)="planning.set(false); generate.emit()" />
    }
  `,
})
export class HomeSchedule {
  readonly schedule = inject(ScheduleService);
  private readonly lang = inject(MnLanguageService);

  /** Days on which a workout with sets was logged: a plan on such a day was not missed. */
  readonly trainedDates = input<Set<string>>(new Set());
  readonly open = output<{ item: ScheduledWorkout; status: ScheduleStatus }>();
  /** "Let the coach plan the whole week" was chosen in the Schedule sheet. */
  readonly generate = output<void>();

  readonly planning = signal(false);
  readonly showAll = signal(false);
  readonly preview = PREVIEW;
  readonly statusKey = statusKey;

  /** Missed plans, then today and later; finished ones are not listed. */
  readonly rows = computed(() => {
    const today = todayIso();
    const trained = this.trainedDates();
    const all = this.schedule
      .items()
      .map((item) => ({ item, status: scheduleStatus(item, today, trained) }))
      .filter((r) => r.status === 'missed' || r.status === 'today' || r.status === 'upcoming');
    return [...all.filter((r) => r.status === 'missed'), ...all.filter((r) => r.status !== 'missed')];
  });
  readonly shown = computed(() => (this.showAll() ? this.rows() : this.rows().slice(0, PREVIEW)));

  /** Today and missed plans say how they stand; the rest says what is in them. */
  subtitle(item: ScheduledWorkout, status: ScheduleStatus): string {
    if (status === 'today' || status === 'missed') return this.lang.t(statusKey(status));
    const n = item.exercises.length;
    return this.lang.t(n === 1 ? 'schedule.plan.exercises.one' : 'schedule.plan.exercises', { n });
  }

  ariaFor(item: ScheduledWorkout, status: ScheduleStatus): string {
    return `${item.name}, ${this.day(item.date)}, ${this.subtitle(item, status)}`;
  }

  day(date: string): string {
    return scheduleDay(date, todayIso(), this.lang);
  }

  weekday(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(this.lang.locale === 'nl' ? 'nl-NL' : 'en-GB', { weekday: 'short' });
  }

  dayOfMonth(date: string): number {
    return Number(date.slice(8, 10));
  }
}
