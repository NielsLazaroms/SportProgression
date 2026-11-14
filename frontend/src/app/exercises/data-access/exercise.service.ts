import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  WorkoutExercise,
  CreateWorkoutExercise,
} from '../models/exercise.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  constructor(private http: HttpClient) {}

  private baseUrl(workoutId: string): string {
    return `${environment.backendUrl}/workouts/${workoutId}/exercises`;
  }

  getExercises(workoutId: string): Observable<WorkoutExercise[]> {
    return this.http.get<WorkoutExercise[]>(this.baseUrl(workoutId));
  }

  createExercise(
    workoutId: string,
    exercise: CreateWorkoutExercise,
  ): Observable<WorkoutExercise> {
    return this.http.post<WorkoutExercise>(this.baseUrl(workoutId), exercise);
  }

  updateExercise(
    workoutId: string,
    exerciseId: number,
    dto: Partial<CreateWorkoutExercise>,
  ): Observable<WorkoutExercise> {
    return this.http.patch<WorkoutExercise>(
      `${this.baseUrl(workoutId)}/${exerciseId}`,
      dto,
    );
  }

  /**
   * Saves the order of ALL exercises of the workout plus their superset
   * grouping (same `supersetGroup` on neighbours = one superset; the server
   * drops groups that are not at least two adjacent exercises and renumbers).
   * Returns the exercises in their new order.
   */
  arrange(
    workoutId: string,
    exercises: { id: number; supersetGroup?: number | null }[],
  ): Observable<WorkoutExercise[]> {
    return this.http.put<WorkoutExercise[]>(
      `${this.baseUrl(workoutId)}/arrangement`,
      { exercises },
    );
  }

  deleteExercise(
    workoutId: string,
    exerciseId: number,
  ): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl(workoutId)}/${exerciseId}`,
    );
  }
}
