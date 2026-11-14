import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { ProgressService } from '../../data-access/progress.service';
import {
  ExerciseOverview,
  ProgressSummary,
  ProgressWeek,
  RecentRecord,
} from '../../models/progress.model';
import {
  compactKg,
  formatKg,
  formatNumber,
  plural,
  relativeDay,
  shortDate,
} from '../../../shared/format';

type WeekMetric = 'workouts' | 'volume';
type TrendDir = 'up' | 'down' | 'flat';

interface WeekBar {
  week: ProgressWeek;
  /** Bar height in % of the tallest bar (0 for an empty week). */
  pct: number;
  isCurrent: boolean;
  selected: boolean;
  /** Short date under the bar, only for a few weeks to keep the axis readable. */
  label: string | null;
}

/** Show the exercise search box only once the list is long enough to need it. */
const SEARCH_THRESHOLD = 6;

@Component({
  selector: 'app-progress-page',
  standalone: true,
  imports: [AppHeader, AppIcon, RouterLink, MnSkeleton, MnTranslatePipe],
  templateUrl: './progress-page.html',
})
export class ProgressPage implements OnInit {
  private readonly progress = inject(ProgressService);
  private readonly lang = inject(MnLanguageService);

  readonly summary = signal<ProgressSummary | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly weekMetric = signal<WeekMetric>('workouts');
  /** Index into `weekly`; null means "the current week". */
  readonly selectedWeek = signal<number | null>(null);
  readonly query = signal('');

  readonly weekMetrics: { id: WeekMetric; label: string }[] = [
    { id: 'workouts', label: 'progress.metric.workouts' },
    { id: 'volume', label: 'progress.metric.volume' },
  ];

  /** Brand-new account: nothing logged at all. */
  readonly isEmpty = computed(() => {
    const s = this.summary();
    return !!s && s.totals.workouts === 0 && s.exercises.length === 0;
  });

  private readonly activeWeekIndex = computed(() => {
    const n = this.summary()?.weekly.length ?? 0;
    const sel = this.selectedWeek();
    return sel != null && sel < n ? sel : n - 1;
  });

  readonly bars = computed<WeekBar[]>(() => {
    const weekly = this.summary()?.weekly ?? [];
    const metric = this.weekMetric();
    const value = (w: ProgressWeek) =>
      metric === 'workouts' ? w.workouts : w.volumeKg;
    const max = Math.max(0, ...weekly.map(value));
    const last = weekly.length - 1;
    const active = this.activeWeekIndex();
    const locale = this.lang.locale;

    return weekly.map((week, i) => {
      const v = value(week);
      return {
        week,
        pct: max > 0 && v > 0 ? Math.max(6, (v / max) * 100) : 0,
        isCurrent: i === last,
        selected: i === active,
        label: i % 4 === 0 && i < last - 1 ? shortDate(week.weekStart, locale) : null,
      };
    });
  });

  readonly activeWeek = computed<ProgressWeek | null>(() => {
    const weekly = this.summary()?.weekly ?? [];
    return weekly[this.activeWeekIndex()] ?? null;
  });

  readonly activeWeekIsCurrent = computed(
    () => this.activeWeekIndex() === (this.summary()?.weekly.length ?? 0) - 1,
  );

  /**
   * Average workouts per week, counted from the first active week in the
   * window so a new user isn't dragged down by weeks before they started.
   */
  readonly avgWorkouts = computed<number | null>(() => {
    const weekly = this.summary()?.weekly ?? [];
    const first = weekly.findIndex((w) => w.workouts > 0);
    if (first < 0) return null;
    const span = weekly.slice(first);
    return span.reduce((sum, w) => sum + w.workouts, 0) / span.length;
  });

  readonly muscles = computed(() => {
    const groups = this.summary()?.muscleGroups ?? [];
    const max = Math.max(0, ...groups.map((g) => g.workouts));
    return groups.map((g) => ({
      key: g.muscleGroup,
      workouts: g.workouts,
      pct: max > 0 ? (g.workouts / max) * 100 : 0,
    }));
  });

  readonly showSearch = computed(
    () => (this.summary()?.exercises.length ?? 0) > SEARCH_THRESHOLD,
  );

  readonly filteredExercises = computed<ExerciseOverview[]>(() => {
    const all = this.summary()?.exercises ?? [];
    const q = this.query().trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        this.muscleLabel(e.muscleGroup).toLowerCase().includes(q),
    );
  });

  readonly plural = plural;
  /** "12.4k" style volume in the user's locale (no unit). */
  readonly volume = (n: number) => compactKg(n, this.lang.locale);
  /** A weight / average: at most one decimal, localized, no trailing ".0". */
  readonly kg = (n: number) => formatKg(n, this.lang.locale);
  readonly rel = (d: string) =>
    relativeDay(d, (k, p) => this.lang.t(k, p), this.lang.locale);
  readonly day = (d: string) => shortDate(d, this.lang.locale);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.progress.getSummary().subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Translated muscle-group label, falling back to the raw stored value. */
  muscleLabel(value: string | null | undefined): string {
    if (!value) return this.lang.t('progress.muscle.other');
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  /** "1 workout" / "3 workouts" style counts via `<key>.one` + `<key>`. */
  count(key: string, n: number): string {
    return this.lang.t(plural(n, key), { n });
  }

  /** "8 weeks in a row" / "1 week in a row" / "No streak yet". */
  streakText(weeks: number): string {
    return weeks > 0
      ? this.count('progress.streak', weeks)
      : this.lang.t('progress.streak.none');
  }

  weekAria(week: ProgressWeek): string {
    const parts = [
      this.lang.t('progress.week.of', { date: this.day(week.weekStart) }),
      this.count('progress.nWorkouts', week.workouts),
    ];
    if (week.volumeKg > 0) {
      parts.push(`${this.volume(week.volumeKg)} ${this.lang.t('unit.kg')}`);
    }
    return parts.join(', ');
  }

  /** "100 kg", or "BW" for a bodyweight (0 kg) set. */
  weightText(weightKg: number): string {
    return weightKg > 0
      ? `${this.kg(weightKg)} ${this.lang.t('unit.kg')}`
      : this.lang.t('unit.bw');
  }

  /** What the record was: "Heaviest ever · 185 kg × 1" / "Most reps · 13 × BW". */
  recordText(r: RecentRecord): string {
    const set =
      r.kind === 'weight'
        ? `${this.weightText(r.weightKg)} × ${r.reps}`
        : `${r.reps} × ${this.weightText(r.weightKg)}`;
    // Non-breaking spaces keep the set itself on one line when the text wraps.
    return `${this.lang.t('progress.rec.' + r.kind)} · ${set.replace(/ /g, ' ')}`;
  }

  /** Null with fewer than two sessions: there is nothing to compare yet. */
  trendDir(e: ExerciseOverview): TrendDir | null {
    if (e.trendPct == null) return null;
    if (e.trendPct >= 0.05) return 'up';
    if (e.trendPct <= -0.05) return 'down';
    return 'flat';
  }

  /** "+12.5%" / "−8.3%" / "0%": max one decimal, no trailing ".0". */
  trendText(e: ExerciseOverview): string {
    const pct = e.trendPct ?? 0;
    const abs = Math.abs(pct);
    const dir = this.trendDir(e);
    const num = formatNumber(dir === 'flat' ? 0 : abs, this.lang.locale, abs >= 100 ? 0 : 1);
    return `${dir === 'up' ? '+' : dir === 'down' ? '−' : ''}${num}%`;
  }
}
