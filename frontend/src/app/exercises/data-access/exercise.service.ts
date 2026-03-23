import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Exercise, CreateExercise } from '../models/exercise.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  constructor(private http: HttpClient) {}

  private baseUrl(workoutId: string): string {
    return `${environment.backendUrl}/workouts/${workoutId}/exercises`;
  }

  getExercises(workoutId: string): Observable<Exercise[]> {
    return this.http.get<Exercise[]>(this.baseUrl(workoutId));
  }

  createExercise(workoutId: string, exercise: CreateExercise): Observable<Exercise> {
    return this.http.post<Exercise>(this.baseUrl(workoutId), exercise);
  }

  deleteExercise(workoutId: string, exerciseId: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl(workoutId)}/${exerciseId}`);
  }
}
