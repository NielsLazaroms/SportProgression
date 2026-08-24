import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Workout, CreateWorkout } from '../models/workout.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.backendUrl}/workouts`;

  getWorkouts(): Observable<Workout[]> {
    return this.http.get<Workout[]>(this.baseUrl);
  }

  /** Returns the full workout tree (exercises + sets). */
  getWorkout(id: string): Observable<Workout> {
    return this.http.get<Workout>(`${this.baseUrl}/${id}`);
  }

  createWorkout(workout: CreateWorkout): Observable<Workout> {
    return this.http.post<Workout>(this.baseUrl, workout);
  }

  updateWorkout(id: string, workout: Partial<CreateWorkout>): Observable<Workout> {
    return this.http.patch<Workout>(`${this.baseUrl}/${id}`, workout);
  }

  /** Re-run: deep-copies a workout into a new one dated today. */
  duplicateWorkout(id: string): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}/${id}/duplicate`, {});
  }

  /** Finish (lock) a workout permanently. Fails if it has empty exercises. */
  finishWorkout(id: string): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}/${id}/finish`, {});
  }

  deleteWorkout(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
