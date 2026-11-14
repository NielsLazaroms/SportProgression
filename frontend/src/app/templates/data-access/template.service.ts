import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { todayIso } from '../../shared/format';
import { Workout } from '../../workouts/models/workout.model';
import { SaveTemplate, WorkoutTemplate } from '../models/template.model';

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.backendUrl}/templates`;

  getAll(): Observable<WorkoutTemplate[]> {
    return this.http.get<WorkoutTemplate[]>(this.baseUrl);
  }

  getOne(id: string): Observable<WorkoutTemplate> {
    return this.http.get<WorkoutTemplate>(`${this.baseUrl}/${id}`);
  }

  create(template: SaveTemplate): Observable<WorkoutTemplate> {
    return this.http.post<WorkoutTemplate>(this.baseUrl, template);
  }

  /** Replaces the name and the whole exercise list. */
  update(id: string, template: SaveTemplate): Observable<WorkoutTemplate> {
    return this.http.put<WorkoutTemplate>(`${this.baseUrl}/${id}`, template);
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }

  /**
   * "Save as template": per exercise, the number of working sets done at the
   * reps used most often. Exercises without working sets are left out.
   */
  createFromWorkout(workoutId: string, name?: string): Observable<WorkoutTemplate> {
    return this.http.post<WorkoutTemplate>(
      `${this.baseUrl}/from-workout/${workoutId}`,
      name ? { name } : {},
    );
  }

  /** Starts a workout from the plan; returns the new workout with its exercises. */
  start(
    id: string,
    details: { name?: string; date?: string; description?: string } = {},
  ): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}/${id}/start`, {
      date: todayIso(),
      ...details,
    });
  }
}
