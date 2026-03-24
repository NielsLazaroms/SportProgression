import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WorkoutService } from '../../data-access/workout.service';
import { ExerciseService } from '../../../exercises/data-access/exercise.service';
import { ExerciseDefinitionService } from '../../../exercises/data-access/exercise-definition.service';
import { SetService } from '../../../exercises/data-access/set.service';
import { Workout } from '../../models/workout.model';
import {
  WorkoutExercise,
  ExerciseDefinition,
  CreateWorkoutExercise,
  CreateSet,
} from '../../../exercises/models/exercise.model';

@Component({
  selector: 'app-workout-detail-page',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './workout-detail-page.html',
})
export class WorkoutDetailPage implements OnInit {
  workout: Workout | null = null;
  exercises: WorkoutExercise[] = [];
  definitions: ExerciseDefinition[] = [];
  errorMessage = '';
  workoutId = '';

  selectedDefinitionId: number | null = null;
  newNotes = '';

  // Per-exercise new set form state, keyed by exercise id
  newSets: { [exerciseId: number]: { repsAmount: number; weightKg: number; notes: string } } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
    private exerciseService: ExerciseService,
    private definitionService: ExerciseDefinitionService,
    private setService: SetService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.workoutId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadWorkout();
    this.loadExercises();
    this.loadDefinitions();
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

  loadDefinitions(): void {
    this.definitionService.getAll().subscribe({
      next: (data) => {
        this.definitions = data;
        if (data.length > 0 && !this.selectedDefinitionId) {
          this.selectedDefinitionId = data[0].id;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon oefeningen catalogus niet ophalen';
        this.cdr.detectChanges();
      },
    });
  }

  loadExercises(): void {
    this.exerciseService.getExercises(this.workoutId).subscribe({
      next: (data) => {
        this.exercises = data;
        // Initialize new set forms for each exercise
        for (const ex of data) {
          if (!this.newSets[ex.id]) {
            this.newSets[ex.id] = { repsAmount: 10, weightKg: 20, notes: '' };
          }
        }
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
    if (!this.selectedDefinitionId) return;
    const dto: CreateWorkoutExercise = {
      exerciseDefinitionId: this.selectedDefinitionId,
      orderInWorkout: this.exercises.length + 1,
      notes: this.newNotes || undefined,
    };
    this.exerciseService.createExercise(this.workoutId, dto).subscribe({
      next: () => {
        this.loadExercises();
        this.newNotes = '';
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

  addSet(exerciseId: number): void {
    const form = this.newSets[exerciseId];
    if (!form) return;
    const exercise = this.exercises.find((e) => e.id === exerciseId);
    const nextOrder = exercise ? (exercise.sets?.length ?? 0) + 1 : 1;
    const dto: CreateSet = {
      setOrder: nextOrder,
      repsAmount: form.repsAmount,
      weightKg: form.weightKg,
      notes: form.notes || undefined,
    };
    this.setService.createSet(exerciseId, dto).subscribe({
      next: () => {
        this.loadExercises();
        this.newSets[exerciseId] = { repsAmount: 10, weightKg: 20, notes: '' };
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon set niet toevoegen';
        this.cdr.detectChanges();
      },
    });
  }

  deleteSet(exerciseId: number, setId: number): void {
    this.setService.deleteSet(exerciseId, setId).subscribe({
      next: () => {
        this.loadExercises();
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon set niet verwijderen';
        this.cdr.detectChanges();
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/workouts']);
  }
}
