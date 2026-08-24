import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  MnAlertService,
  MnLanguageService,
  MnSkeleton,
  MnTranslatePipe,
} from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { WorkoutService } from '../../data-access/workout.service';
import {
  Workout,
  workoutSetCount,
  workoutVolumeKg,
} from '../../models/workout.model';
import { compactKg, relativeDay, timeOfDay } from '../../../shared/format';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [AppHeader, FormsModule, AppIcon, MnSkeleton, MnTranslatePipe],
  templateUrl: './history-page.html',
})
export class HistoryPage implements OnInit {
  private readonly workoutService = inject(WorkoutService);
  private readonly router = inject(Router);
  private readonly alerts = inject(MnAlertService);
  private readonly lang = inject(MnLanguageService);

  readonly workouts = signal<Workout[]>([]);
  readonly loading = signal(true);
  readonly query = signal('');
  readonly rerunningId = signal<string | null>(null);

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.workouts();
    return this.workouts().filter((w) =>
      (w.name + ' ' + (w.description ?? '')).toLowerCase().includes(q),
    );
  });

  readonly volume = workoutVolumeKg;
  readonly setCount = workoutSetCount;
  readonly compactKg = compactKg;
  readonly timeOfDay = timeOfDay;
  readonly rel = (d: string) =>
    relativeDay(d, (k, p) => this.lang.t(k, p), this.lang.locale);

  ngOnInit(): void {
    this.workoutService.getWorkouts().subscribe({
      next: (data) => {
        this.workouts.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.alerts.error(
          this.lang.t('toast.load.err.title'),
          this.lang.t('toast.retry'),
        );
      },
    });
  }

  exerciseCount(w: Workout): number {
    return w.exercises?.length ?? 0;
  }

  open(w: Workout): void {
    this.router.navigate(['/workouts', w.id]);
  }

  reRun(w: Workout, event: Event): void {
    event.stopPropagation();
    if (this.rerunningId()) return;
    this.rerunningId.set(w.id);
    this.workoutService.duplicateWorkout(w.id).subscribe({
      next: (copy) => {
        this.rerunningId.set(null);
        this.alerts.success(
          this.lang.t('toast.rerun.done.title'),
          this.lang.t('toast.rerun.done.body', { name: w.name }),
        );
        this.router.navigate(['/workouts', copy.id]);
      },
      error: () => {
        this.rerunningId.set(null);
        this.alerts.error(
          this.lang.t('toast.rerun.err'),
          this.lang.t('toast.retry'),
        );
      },
    });
  }
}
