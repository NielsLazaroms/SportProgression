import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { ProgressService } from '../../data-access/progress.service';
import {
  ExerciseHistory,
  ExerciseSession,
  RecordKind,
} from '../../models/progress.model';
import {
  BodyweightTag,
  bodyweightChipText,
  extraWeightText,
} from '../../../shared/bodyweight';
import {
  compactKg,
  formatKg,
  formatNumber,
  plural,
  relativeDay,
  shortDate,
} from '../../../shared/format';

type Metric = 'e1rm' | 'weight' | 'volume' | 'reps' | 'totalReps';
type LoadState = 'loading' | 'ready' | 'notFound' | 'error';

interface ChartPoint {
  session: ExerciseSession;
  value: number;
  /** Position inside the plot area, in % (0,0 = top-left). */
  x: number;
  y: number;
}

interface MetricOption {
  id: Metric;
  label: string;
  explain: string;
}

const METRIC_VALUE: Record<Metric, (s: ExerciseSession) => number> = {
  e1rm: (s) => s.e1rmKg,
  weight: (s) => s.topWeightKg,
  volume: (s) => s.volumeKg,
  reps: (s) => s.topReps,
  totalReps: (s) => s.totalReps,
};

/** Metrics that count reps (shown without "kg"). */
const REP_METRICS: Metric[] = ['reps', 'totalReps'];

/**
 * A bodyweight exercise: reps lead; the weight is only the EXTRA weight, so an
 * estimated 1RM or a kg volume calculated from it would be meaningless.
 */
const BODYWEIGHT_METRICS: MetricOption[] = [
  { id: 'reps', label: 'progress.ex.metric.reps', explain: 'progress.ex.explain.reps' },
  { id: 'totalReps', label: 'bw.metric.totalReps', explain: 'bw.explain.totalReps' },
  { id: 'weight', label: 'bw.metric.weight', explain: 'bw.explain.weight' },
];

const ALL_METRICS: MetricOption[] = [
  { id: 'e1rm', label: 'progress.ex.metric.e1rm', explain: 'progress.ex.explain.e1rm' },
  { id: 'weight', label: 'progress.ex.metric.weight', explain: 'progress.ex.explain.weight' },
  { id: 'volume', label: 'progress.ex.metric.volume', explain: 'progress.ex.explain.volume' },
  { id: 'reps', label: 'progress.ex.metric.reps', explain: 'progress.ex.explain.reps' },
];

const APP_TITLE = 'Iron Pulse';

@Component({
  selector: 'app-exercise-progress-page',
  standalone: true,
  imports: [AppHeader, AppIcon, BodyweightTag, RouterLink, MnSkeleton, MnTranslatePipe],
  templateUrl: './exercise-progress-page.html',
})
export class ExerciseProgressPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressService);
  private readonly lang = inject(MnLanguageService);
  private readonly title = inject(Title);

  private definitionId = NaN;

  readonly state = signal<LoadState>('loading');
  readonly history = signal<ExerciseHistory | null>(null);

  /** The metric the user picked; null until they pick one. */
  private readonly metricChoice = signal<Metric | null>(null);
  /** Index into `sessions`; null means "the latest session". */
  readonly selected = signal<number | null>(null);

  readonly sessions = computed(() => this.history()?.sessions ?? []);
  readonly sessionsNewestFirst = computed(() => [...this.sessions()].reverse());

  /** Every session at 0 kg: only reps say anything about progress. */
  readonly bodyweightOnly = computed(() => {
    const sessions = this.sessions();
    return sessions.length > 0 && sessions.every((s) => s.topWeightKg === 0);
  });

  /** A bodyweight exercise: logged weights are extra weight. */
  readonly bodyweight = computed(() => !!this.history()?.bodyweight);

  /** kg-based metrics are hidden when they would all be zero. */
  readonly metrics = computed<MetricOption[]>(() => {
    if (this.bodyweight()) {
      return this.bodyweightOnly()
        ? BODYWEIGHT_METRICS.filter((m) => m.id !== 'weight')
        : BODYWEIGHT_METRICS;
    }
    return this.bodyweightOnly() ? ALL_METRICS.filter((m) => m.id === 'reps') : ALL_METRICS;
  });

  readonly metricOption = computed<MetricOption>(() => {
    const options = this.metrics();
    return options.find((m) => m.id === this.metricChoice()) ?? options[0];
  });
  readonly metric = computed<Metric>(() => this.metricOption().id);

  /** Lowest / highest value of the chosen metric — the chart's y range. */
  private readonly range = computed(() => {
    const values = this.sessions().map(METRIC_VALUE[this.metric()]);
    if (!values.length) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  });

  readonly points = computed<ChartPoint[]>(() => {
    const sessions = this.sessions();
    const value = METRIC_VALUE[this.metric()];
    const { min, max } = this.range();
    const span = max - min;
    const n = sessions.length;
    return sessions.map((session, i) => {
      const v = value(session);
      return {
        session,
        value: v,
        // A single session sits in the middle; a flat series runs mid-height.
        x: n > 1 ? (i / (n - 1)) * 100 : 50,
        y: span > 0 ? 100 - ((v - min) / span) * 100 : 50,
      };
    });
  });

  readonly linePath = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '';
    return pts
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  });

  readonly areaPath = computed(() => {
    const line = this.linePath();
    return line ? `${line} L100 100 L0 100 Z` : '';
  });

  /** y-axis labels: max on top + min at the bottom, or one mid label when flat. */
  readonly yLabels = computed(() => {
    const { min, max } = this.range();
    if (!this.sessions().length) return [];
    if (max === min) return [{ top: 50, text: this.metricText(max) }];
    return [
      { top: 0, text: this.metricText(max) },
      { top: 100, text: this.metricText(min) },
    ];
  });

  /** Thin the dots out once there are too many to tell apart on a phone. */
  readonly dense = computed(() => this.sessions().length > 20);

  readonly activeIndex = computed(() => {
    const n = this.sessions().length;
    const sel = this.selected();
    return sel != null && sel < n ? sel : n - 1;
  });

  readonly active = computed<ChartPoint | null>(
    () => this.points()[this.activeIndex()] ?? null,
  );

  /**
   * Change of the chosen metric from the first session to the SELECTED one,
   * in %. Null for the first session itself or when there is no baseline.
   */
  readonly change = computed<{ pct: number } | null>(() => {
    const pts = this.points();
    const i = this.activeIndex();
    if (i < 1 || !pts[i]) return null;
    const first = pts[0].value;
    return first > 0 ? { pct: ((pts[i].value - first) / first) * 100 } : null;
  });

  readonly rel = (d: string) =>
    relativeDay(d, (k, p) => this.lang.t(k, p), this.lang.locale);
  readonly day = (d: string) => shortDate(d, this.lang.locale);
  readonly fullDay = (d: string) => shortDate(d, this.lang.locale, true);

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id') ?? '';
    this.definitionId = /^\d+$/.test(raw) ? Number(raw) : NaN;
    this.load();
  }

  ngOnDestroy(): void {
    this.title.setTitle(APP_TITLE);
  }

  load(): void {
    if (Number.isNaN(this.definitionId)) {
      this.state.set('notFound');
      return;
    }
    this.state.set('loading');
    this.progress.getExerciseHistory(this.definitionId).subscribe({
      next: (h) => {
        this.history.set(h);
        this.selected.set(null);
        if (h.name) this.title.setTitle(`${h.name} · ${APP_TITLE}`);
        // The API 404s without history, but stay safe if it ever sends [].
        this.state.set(h.sessions.length ? 'ready' : 'notFound');
      },
      error: (err: HttpErrorResponse) =>
        this.state.set(err?.status === 404 ? 'notFound' : 'error'),
    });
  }

  setMetric(id: Metric): void {
    this.metricChoice.set(id);
  }

  /** A weight: at most one decimal, localized, never a trailing ".0". */
  kg(n: number): string {
    return formatKg(n, this.lang.locale);
  }

  /** "12.4k" style volume in the user's locale (no unit). */
  volume(n: number): string {
    return compactKg(n, this.lang.locale);
  }

  /** Bare number for a value of the chosen metric (volume is compacted). */
  metricText(value: number): string {
    switch (this.metric()) {
      case 'volume':
        return this.volume(value);
      case 'reps':
      case 'totalReps':
        return formatNumber(value, this.lang.locale, 0);
      default:
        return this.kg(value);
    }
  }

  /** Unit that goes with a value of the chosen metric: "kg" or "rep(s)". */
  metricUnit(value: number): string {
    return this.lang.t(
      REP_METRICS.includes(this.metric()) ? plural(value, 'unit.reps') : 'unit.kg',
    );
  }

  /** "100 kg", or "BW" for a bodyweight (0 kg) set; "+10 kg" on a bodyweight exercise. */
  weightText(weightKg: number): string {
    if (weightKg > 0 && this.bodyweight()) return this.extraText(weightKg);
    return weightKg > 0
      ? `${this.kg(weightKg)} ${this.lang.t('unit.kg')}`
      : this.lang.t('unit.bw');
  }

  /** "+10 kg": extra weight on top of body weight. */
  extraText(weightKg: number): string {
    return extraWeightText(weightKg, (k, p) => this.lang.t(k, p), this.lang.locale);
  }

  /** One set of a session as a chip: "8 × 60 kg" / "12 × BW" / "8 × +10 kg". */
  chipText(set: { reps: number; weightKg: number }): string {
    if (this.bodyweight()) {
      return bodyweightChipText(
        set.reps,
        set.weightKg,
        (k, p) => this.lang.t(k, p),
        this.lang.locale,
        true,
      );
    }
    return `${set.reps} × ${this.weightText(set.weightKg)}`;
  }

  /** "3 reps" / "1 rep". */
  repsText(reps: number): string {
    return `${reps} ${this.lang.t(plural(reps, 'unit.reps'))}`;
  }

  /** What the record was: "Heaviest ever · 185 kg × 1" / "Most reps · 13 × BW". */
  recordText(r: { kind: RecordKind; reps: number; weightKg: number }): string {
    const set =
      r.kind === 'weight'
        ? `${this.weightText(r.weightKg)} × ${r.reps}`
        : `${r.reps} × ${this.weightText(r.weightKg)}`;
    // Non-breaking spaces keep the set itself on one line when the text wraps.
    return `${this.lang.t('progress.rec.' + r.kind)} · ${set.replace(/ /g, ' ')}`;
  }

  /** Hover / tap / drag anywhere on the plot selects the nearest session. */
  onChartPointer(event: PointerEvent): void {
    const n = this.sessions().length;
    if (n < 2) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.selected.set(Math.round(ratio * (n - 1)));
  }

  pointAria(p: ChartPoint): string {
    const parts = [
      this.fullDay(p.session.date),
      `${this.metricText(p.value)} ${this.metricUnit(p.value)}`,
    ];
    if (p.session.record) parts.push(this.recordText(p.session.record));
    else if (p.session.isPr) parts.push(this.lang.t('progress.ex.prLegend'));
    return parts.join(', ');
  }

  /** Direction of a change once rounded to what is displayed. */
  changeDir(pct: number): 'up' | 'down' | 'flat' {
    const shown = Number(pct.toFixed(Math.abs(pct) >= 100 ? 0 : 1));
    return shown > 0 ? 'up' : shown < 0 ? 'down' : 'flat';
  }

  /** "+22.8%" / "−3%" / "0%": max one decimal, no trailing ".0". */
  changeText(pct: number): string {
    const abs = Math.abs(pct);
    const num = formatNumber(abs, this.lang.locale, abs >= 100 ? 0 : 1);
    const dir = this.changeDir(pct);
    return `${dir === 'up' ? '+' : dir === 'down' ? '−' : ''}${num}%`;
  }

  /** Translated muscle-group label, falling back to the raw stored value. */
  muscleLabel(value: string | null | undefined): string {
    if (!value) return '';
    return this.lang.translateIfPresent('muscle.' + value) ?? value;
  }

  /** "1 session" / "3 sessions" style counts via `<key>.one` + `<key>`. */
  count(key: string, n: number): string {
    return this.lang.t(plural(n, key), { n });
  }

  back(): void {
    this.router.navigate(['/progress']);
  }
}
