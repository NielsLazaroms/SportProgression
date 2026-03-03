import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {Workout} from '../../models/workout.model';
import {WorkoutService} from '../../data-access/workout.service';

@Component({
  selector: 'app-workouts-page',
  standalone: true,
  imports: [],
  templateUrl: './workouts-page.html',
})
export class WorkoutsPage implements OnInit {
  constructor(private workoutService: WorkoutService, private cdr: ChangeDetectorRef) {}

  workouts: Workout[] = [];
  errorMessage = '';

  ngOnInit(): void {
    this.workoutService.getWorkouts().subscribe({
      next: (data) => {
        this.workouts = data;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon workouts niet ophalen';
        this.cdr.detectChanges();
      }
    });
  }
}
