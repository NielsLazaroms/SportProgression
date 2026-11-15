import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MnLanguageService, MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { WorkoutService } from '../../data-access/workout.service';
import {
  Workout,
  workoutRepCount,
  workoutSetCount,
  workoutVolumeKg,
} from '../../models/workout.model';
import { NewWorkoutSheet } from '../../components/new-workout-sheet';
import { compactKg, errorHintKey, plural, shortDate } from '../../../shared/format';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [
    AppHeader,
    FormsModule,
    AppIcon,
    MnSkeleton,
    MnTranslatePipe,
    NewWorkoutSheet,
    RouterLink,
  ],
  templateUrl: './history-page.html',
})
export class HistoryPage implements OnInit {
  private readonly workoutService = inject(WorkoutService);
  private readonly lang = inject(MnLanguageService);

  readonly workouts = signal<Workout[]>([]);
  readonly loading = signal(true);
  /** i18n key explaining why loading failed; null when it worked. */
  readonly loadError = signal<string | null>(null);
  readonly query = signal('');

  /** Workout being re-run in the new-workout sheet, if any. */
  readonly rerunSource = signal<Workout | null>(null);

  /** Matches on the workout's name and notes. */
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.workouts();
    return this.workouts().filter((w) =>
      (w.name + ' ' + (w.description ?? '')).toLowerCase().includes(q),
    );
  });

  /** The matching workouts cut into months, newest first, each row ready to show. */
  readonly months = computed(() => {
    const locale = this.lang.locale === 'nl' ? 'nl-NL' : 'en-GB';
    const t = (k: string, p?: Record<string, string | number>) => this.lang.t(k, p);
    const out: {
      key: string;
      label: string;
      count: string;
      rows: { w: Workout; day: number; weekday: string; dateText: string; meta: string; load: string }[];
    }[] = [];
    for (const w of this.filtered()) {
      const iso = String(w.date).slice(0, 10);
      const [y, m, d] = iso.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const key = iso.slice(0, 7);
      let month = out[out.length - 1];
      if (!month || month.key !== key) {
        const label = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        month = { key, label: label.charAt(0).toUpperCase() + label.slice(1), count: '', rows: [] };
        out.push(month);
      }
      const exercises = w.exercises?.length ?? 0;
      const sets = workoutSetCount(w);
      const parts = [
        `${exercises} ${t(plural(exercises, 'unit.exercises'))}`,
        `${sets} ${t(plural(sets, 'unit.sets'))}`,
      ];
      if (!w.completedAt) parts.push(t('badge.inProgress'));
      const kg = workoutVolumeKg(w);
      const reps = workoutRepCount(w);
      month.rows.push({
        w,
        day: d,
        weekday: date.toLocaleDateString(locale, { weekday: 'short' }).replace('.', ''),
        dateText: shortDate(iso, this.lang.locale, true),
        meta: parts.join(', '),
        load:
          kg > 0
            ? `${compactKg(kg, this.lang.locale)} ${t('unit.kg')}`
            : reps > 0
              ? `${reps} ${t(plural(reps, 'unit.reps'))}`
              : '',
      });
    }
    for (const month of out) {
      month.count = t(plural(month.rows.length, 'progress.nWorkouts'), { n: month.rows.length });
    }
    return out;
  });

  // Plain methods (not computed): they must follow a language switch.
  /** "36 workouts logged". */
  headline(): string {
    const n = this.workouts().length;
    return this.lang.t(plural(n, 'history.count'), { n });
  }

  /** "Since 21 Sep 2026": the date of the first workout. */
  sinceLine(): string {
    const all = this.workouts();
    const first = all[all.length - 1];
    return first
      ? this.lang.t('history.since', { date: shortDate(String(first.date).slice(0, 10), this.lang.locale, true) })
      : '';
  }

  ngOnInit(): void {
    this.load();
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
  }
}
