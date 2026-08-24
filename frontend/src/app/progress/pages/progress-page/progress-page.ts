import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MnTranslatePipe } from 'mn-angular-lib';
import { AppIcon } from '../../../shared/app-icon';
import { AppHeader } from '../../../layout/app-header';
import { WorkoutService } from '../../../workouts/data-access/workout.service';
import {
  Workout,
  workoutSetCount,
  workoutVolumeKg,
} from '../../../workouts/models/workout.model';
import { compactKg } from '../../../shared/format';

@Component({
  selector: 'app-progress-page',
  standalone: true,
  imports: [AppHeader, AppIcon, MnTranslatePipe],
  templateUrl: './progress-page.html',
})
export class ProgressPage implements OnInit {
  private readonly workoutService = inject(WorkoutService);

  readonly workouts = signal<Workout[]>([]);
  readonly loading = signal(true);

  readonly totalWorkouts = computed(() => this.workouts().length);
  readonly totalVolume = computed(() =>
    this.workouts().reduce((sum, w) => sum + workoutVolumeKg(w), 0),
  );
  readonly totalSets = computed(() =>
    this.workouts().reduce((sum, w) => sum + workoutSetCount(w), 0),
  );

  readonly compactKg = compactKg;

  ngOnInit(): void {
    this.workoutService.getWorkouts().subscribe({
      next: (data) => {
        this.workouts.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
