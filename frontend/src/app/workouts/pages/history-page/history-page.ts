import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MnSkeleton, MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { WorkoutService } from '../../data-access/workout.service';
import { Workout } from '../../models/workout.model';
import { NewWorkoutSheet } from '../../components/new-workout-sheet';
import { WorkoutRow } from '../../components/workout-row';
import { errorHintKey } from '../../../shared/format';

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
    WorkoutRow,
  ],
  templateUrl: './history-page.html',
})
export class HistoryPage implements OnInit {
  private readonly workoutService = inject(WorkoutService);

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
