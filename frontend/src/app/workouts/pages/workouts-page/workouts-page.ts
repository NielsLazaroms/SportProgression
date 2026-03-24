import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Workout, CreateWorkout} from '../../models/workout.model';
import {WorkoutService} from '../../data-access/workout.service';
import {AuthService} from '../../../auth/data-access/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workouts-page',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './workouts-page.html',
})
export class WorkoutsPage implements OnInit {
  constructor(private workoutService: WorkoutService, private authService: AuthService, private cdr: ChangeDetectorRef, private router: Router) {}

  workouts: Workout[] = [];
  errorMessage = '';

  newWorkout: CreateWorkout = {
    date: new Date().toISOString().split('T')[0],
    name: '',
    description: ''
  };

  ngOnInit(): void {
    this.loadWorkouts();
  }

  loadWorkouts(): void {
    this.workoutService.getWorkouts().subscribe({
      next: (data) => {
        this.workouts = data;
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon workouts niet ophalen';
        this.cdr.detectChanges();
      }
    });
  }

  openWorkout(id: string): void {
    this.router.navigate(['/workouts', id]);
  }

  addWorkout(): void {
    if (!this.newWorkout.date || !this.newWorkout.name) return;

    this.workoutService.createWorkout(this.newWorkout).subscribe({
      next: () => {
        this.loadWorkouts();
        this.newWorkout.name = '';
        this.newWorkout.description = '';
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon workout niet toevoegen';
        this.cdr.detectChanges();
      }
    });
  }

  deleteWorkout(id: string): void {
    this.workoutService.deleteWorkout(id).subscribe({
      next: () => {
        this.loadWorkouts();
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon workout niet verwijderen';
        this.cdr.detectChanges();
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  openCatalog(): void {
    this.router.navigate(['/exercise-definitions']);
  }
  updateWorkout(workout: Workout): void {
    const updatedName = prompt('Bewerk naam:', workout.name);
    if (updatedName === null || updatedName === workout.name) return;

    this.workoutService.updateWorkout(workout.id, { name: updatedName }).subscribe({
      next: () => {
        this.loadWorkouts();
        this.errorMessage = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Kon workout niet bijwerken';
        this.cdr.detectChanges();
      }
    });
  }
}
