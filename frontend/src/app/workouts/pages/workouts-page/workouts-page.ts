import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
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
  constructor(private workoutService: WorkoutService, private authService: AuthService, private cdr: ChangeDetectorRef) {}

  workouts: Workout[] = [];
  errorMessage = '';

  newWorkout: CreateWorkout = {
    date: new Date().toISOString().split('T')[0],
    note: ''
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

  getWorkout(id: string): void {
    this.workoutService.getWorkout(id).subscribe({
      next: (workout) => {
        alert(`Workout Details:\nDatum: ${workout.date}\nOpmerking: ${workout.note}`);
      },
      error: () => {
        this.errorMessage = `Kon workout met ID ${id} niet vinden`;
        this.cdr.detectChanges();
      }
    });
  }

  addWorkout(): void {
    if (!this.newWorkout.date || !this.newWorkout.note) return;

    this.workoutService.createWorkout(this.newWorkout).subscribe({
      next: () => {
        this.loadWorkouts();
        this.newWorkout.note = '';
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

  updateWorkout(workout: Workout): void {
    const updatedNote = prompt('Bewerk opmerking:', workout.note);
    if (updatedNote === null || updatedNote === workout.note) return;

    this.workoutService.updateWorkout(workout.id, { note: updatedNote }).subscribe({
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
