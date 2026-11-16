import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { GoalsSection } from '../../components/goals-section';
import { ProgressService } from '../../data-access/progress.service';
import {
  ExerciseOverview,
  ProgressSummary,
  ProgressWeek,
  RecentRecord,
} from '../../models/progress.model';
import { extraWeightText } from '../../../shared/bodyweight';
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
  /** Height in % of the tallest week (0 for an empty week). */
  pct: number;
  /** Plate height in px on the bar. */
  height: number;
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
  imports: [AppHeader, AppIcon, RouterLink, MnSkeleton, MnTranslatePipe, GoalsSection],
  templateUrl: './progress-page.html',
})
export class ProgressPage implements OnInit {
  private readonly progress = inject(ProgressService);
  private readonly lang = inject(MnLanguageService);

  readonly summary = signal<ProgressSummary | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  /** The 12-week bar counts workouts per week. */
  readonly weekMetric = signal<WeekMetric>('workouts');
  /** The list starts with the lifts trained most recently; the rest is one tap away. */
  readonly previewCount = 6;
  readonly showAll = signal(false);
  /** Index into `weekly`; null means "the current week". */
  readonly selectedWeek = signal<number | null>(null);
  readonly query = signal('');

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
        pct: max > 0 && v > 0 ? (v / max) * 100 : 0,
        // 24px for the lightest week up to 68px for the busiest
        height: max > 0 && v > 0 ? 24 + Math.round((v / max) * 44) : 0,
        isCurrent: i === last,
        selected: i === active,
        label: i % 4 === 0 && i < last - 1 ? shortDate(week.weekStart, locale) : null,
      };
    });
  });

  /**
   * The 12 weeks as one smooth line (volume, or workouts for someone who only
   * trains with bodyweight), in a 0..100 box: x per week column, y from the top.
   * Null until there is something to draw.
   */
  readonly chart = computed(() => {
    const bars = this.bars();
    if (bars.length < 2 || !bars.some((b) => b.pct > 0)) return null;
    const n = bars.length;
    // Leave air above the highest point and keep empty weeks on the floor.
    const pts = bars.map((b, i) => ({ x: ((i + 0.5) / n) * 100, y: 100 - b.pct * 0.86 }));
    let line = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < n; i++) {
      const mid = (pts[i - 1].x + pts[i].x) / 2;
      line += ` C ${mid} ${pts[i - 1].y} ${mid} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
    }
    const area = `${line} L ${pts[n - 1].x} 100 L ${pts[0].x} 100 Z`;
    return {
      metric: this.weekMetric(),
      line,
      area,
      selected: pts[this.activeWeekIndex()] ?? pts[n - 1],
      first: bars[0].week.weekStart,
    };
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

  /**
   * The latest records worth showing: a heavier weight than ever before. For a
   * bodyweight exercise (no weight to beat) a reps record counts instead.
   */
  readonly weightRecords = computed<RecentRecord[]>(() =>
    (this.summary()?.recentRecords ?? [])
      .filter((r) => r.kind === 'weight' || this.bodyweightIds().has(r.exerciseDefinitionId))
      .slice(0, 3),
  );

  readonly shownExercises = computed<ExerciseOverview[]>(() => {
    const list = this.filteredExercises();
    return this.showAll() ? list : list.slice(0, this.previewCount);
  });

  toggleAll(): void {
    this.showAll.update((v) => !v);
    if (!this.showAll()) this.query.set('');
  }

  // Plain methods (not computed): they must follow a language switch.
  /** The answer to "am I getting stronger?": how many lifts are going up. */
  headline(): string {
    const compared = (this.summary()?.exercises ?? []).filter((e) => this.trendDir(e) !== null);
    if (!compared.length) return this.lang.t('progress.head.early');
    const up = compared.filter((e) => this.trendDir(e) === 'up').length;
    if (up === compared.length) return this.lang.t('progress.head.all', { total: compared.length });
    if (up === 0) return this.lang.t('progress.head.none');
    return this.lang.t('progress.head.up', { n: up, total: compared.length });
  }

  /** "8 weeks in a row, avg 3 workouts / week". */
  headlineSub(): string {
    const s = this.summary();
    if (!s) return '';
    const parts = [this.streakText(s.streakWeeks)];
    const avg = this.avgWorkouts();
    if (avg) parts.push(this.avgText(avg));
    return parts.join(', ');
  }

  weekName(w: ProgressWeek): string {
    return this.activeWeekIsCurrent()
      ? this.lang.t('progress.thisWeek')
      : this.lang.t('progress.week.of', { date: this.day(w.weekStart) });
  }

  /** "Heaviest lift 32.5 kg" / "Best set 12 reps, up to +10 kg". */
  bestText(e: ExerciseOverview): string {
    if (!e.bodyweight) {
      return `${this.lang.t('progress.bestLift')} ${this.kg(e.bestWeightKg)} ${this.lang.t('unit.kg')}`;
    }
    const reps = `${this.lang.t('progress.bestSet')} ${e.bestReps} ${this.lang.t(plural(e.bestReps, 'unit.reps'))}`;
    return e.bestWeightKg > 0
      ? `${reps}, ${this.lang.t('bw.upTo', { weight: this.extraText(e.bestWeightKg) })}`
      : reps;
  }

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
        // The line follows kilos moved; someone who only does bodyweight work gets workouts.
        this.weekMetric.set(s.weekly.some((w) => w.volumeKg > 0) ? 'volume' : 'workouts');
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

  /** "avg 2.5 workouts / week" ("avg 1 workout / week"). */
  avgText(avg: number): string {
    return this.lang.t(plural(Number(avg.toFixed(1)), 'progress.avgPerWeek'), {
      n: this.kg(avg),
    });
  }

  /** Definition ids of the exercises whose weights are extra weight. */
  private readonly bodyweightIds = computed(
    () =>
      new Set(
        (this.summary()?.exercises ?? [])
          .filter((e) => e.bodyweight)
          .map((e) => e.exerciseDefinitionId),
      ),
  );

  /** "+10 kg": extra weight on top of body weight. */
  extraText(weightKg: number): string {
    return extraWeightText(weightKg, (k, p) => this.lang.t(k, p), this.lang.locale);
  }

  /**
   * What the record was: "Heaviest ever · 185 kg × 1" / "Most reps · 13 reps"
   * (a set without weight: no "BW" abbreviation); bodyweight exercise with
   * extra weight: "Heaviest ever · +10 kg × 6".
   */
  recordText(r: RecentRecord): string {
    const weight = this.bodyweightIds().has(r.exerciseDefinitionId)
      ? this.extraText(r.weightKg)
      : `${this.kg(r.weightKg)} ${this.lang.t('unit.kg')}`;
    const set = !(r.weightKg > 0)
      ? `${r.reps} ${this.lang.t(plural(r.reps, 'unit.reps'))}`
      : r.kind === 'weight'
        ? `${weight} × ${r.reps}`
        : `${r.reps} × ${weight}`;
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
