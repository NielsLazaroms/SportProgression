import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ExerciseDefinitionService } from '../../../exercises/data-access/exercise-definition.service';
import {
  ExerciseDefinition,
  ExerciseType,
  CreateExerciseDefinition,
} from '../../../exercises/models/exercise.model';

@Component({
  selector: 'app-exercise-definitions-page',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './exercise-definitions-page.html',
})
export class ExerciseDefinitionsPage implements OnInit {
  definitions: ExerciseDefinition[] = [];
  errorMessage = '';

  exerciseTypes = [
    { value: ExerciseType.STRENGTH, label: 'Strength' },
    { value: ExerciseType.RUN, label: 'Run' },
    { value: ExerciseType.CYCLING, label: 'Cycling' },
    { value: ExerciseType.BODYWEIGHT, label: 'Bodyweight' },
  ];

  newDefinition: CreateExerciseDefinition = {
    name: '',
    type: ExerciseType.STRENGTH,
    muscleGroup: '',
  };

  constructor(
    private definitionService: ExerciseDefinitionService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadDefinitions();
  }

  loadDefinitions(): void {
    this.definitionService.getAll().subscribe({
      next: (data) => {
        this.definitions = data;
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon oefeningen niet ophalen';
        this.cdr.detectChanges();
      },
    });
  }

  addDefinition(): void {
    if (!this.newDefinition.name) return;
    const dto: CreateExerciseDefinition = {
      name: this.newDefinition.name,
      type: this.newDefinition.type,
    };
    if (this.newDefinition.muscleGroup) {
      dto.muscleGroup = this.newDefinition.muscleGroup;
    }
    this.definitionService.create(dto).subscribe({
      next: () => {
        this.loadDefinitions();
        this.newDefinition.name = '';
        this.newDefinition.muscleGroup = '';
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon oefening niet toevoegen';
        this.cdr.detectChanges();
      },
    });
  }

  deleteDefinition(id: number): void {
    this.definitionService.delete(id).subscribe({
      next: () => {
        this.loadDefinitions();
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
