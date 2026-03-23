import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WorkoutService } from '../../data-access/workout.service';
import { ExerciseService } from '../../../exercises/data-access/exercise.service';
import { Workout } from '../../models/workout.model';
import { Exercise, ExerciseType, CreateExercise } from '../../../exercises/models/exercise.model';

@Component({
  selector: 'app-workout-detail-page',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './workout-detail-page.html',
})
export class WorkoutDetailPage implements OnInit {
  workout: Workout | null = null;
  exercises: Exercise[] = [];
  errorMessage = '';
  workoutId = '';

  exerciseTypes = [
    { value: ExerciseType.STRENGTH, label: 'Strength' },
    { value: ExerciseType.RUN, label: 'Run' },
    { value: ExerciseType.CYCLING, label: 'Cycling' },
    { value: ExerciseType.BODYWEIGHT, label: 'Bodyweight' },
  ];

  newExercise: CreateExercise = {
    type: ExerciseType.STRENGTH,
    name: '',
    orderInWorkout: 1,
    notes: '',
    muscleGroup: '',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
    private exerciseService: ExerciseService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.workoutId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadWorkout();
    this.loadExercises();
  }

  loadWorkout(): void {
    this.workoutService.getWorkout(this.workoutId).subscribe({
      next: (data) => {
        this.workout = data;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon workout niet ophalen';
        this.cdr.detectChanges();
      },
    });
  }

  loadExercises(): void {
    this.exerciseService.getExercises(this.workoutId).subscribe({
      next: (data) => {
        this.exercises = data;
        this.newExercise.orderInWorkout = data.length + 1;
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon oefeningen niet ophalen';
        this.cdr.detectChanges();
      },
    });
  }

  addExercise(): void {
    if (!this.newExercise.name) return;

    this.exerciseService.createExercise(this.workoutId, this.newExercise).subscribe({
      next: () => {
        this.loadExercises();
        this.newExercise.name = '';
        this.newExercise.notes = '';
        this.newExercise.muscleGroup = '';
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon oefening niet toevoegen';
        this.cdr.detectChanges();
      },
    });
  }

  deleteExercise(exerciseId: number): void {
    this.exerciseService.deleteExercise(this.workoutId, exerciseId).subscribe({
      next: () => {
        this.loadExercises();
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon oefening niet verwijderen';
        this.cdr.detectChanges();
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/workouts']);
  }
}
