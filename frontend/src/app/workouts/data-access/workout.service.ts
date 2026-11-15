import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Workout, CreateWorkout } from '../models/workout.model';
import { todayIso } from '../../shared/format';
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

  /** A new workout that starts with exercises and their target sets × reps. */
  createPlanned(plan: {
    name: string;
    date: string;
    exercises: { exerciseDefinitionId: number; targetSets: number; targetReps: number; notes?: string }[];
  }): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}/planned`, plan);
  }

  /** Re-run: copies a workout's exercises (not sets) into a new one dated today. */
  duplicateWorkout(
    id: string,
    overrides: Partial<CreateWorkout> = {},
  ): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}/${id}/duplicate`, {
      date: todayIso(),
      ...overrides,
    });
  }

  /** Finish (lock) a workout permanently. Fails if it has empty exercises. */
  finishWorkout(id: string): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}/${id}/finish`, {});
  }

  /** Unlock a finished workout so it can be edited again. */
  reopenWorkout(id: string): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}/${id}/reopen`, {});
  }

  deleteWorkout(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
