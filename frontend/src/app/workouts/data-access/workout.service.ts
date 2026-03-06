import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Workout, CreateWorkout} from '../models/workout.model'
import {environment} from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly baseUrl = `${environment.backendUrl}/workouts`;
  constructor(private http: HttpClient) {}

  getWorkouts(): Observable<Workout[]> {
    return this.http.get<Workout[]>(`${this.baseUrl}`);
  }

  getWorkout(id: string): Observable<Workout> {
    return this.http.get<Workout>(`${this.baseUrl}/${id}`);
  }

  createWorkout(workout: CreateWorkout): Observable<Workout> {
    return this.http.post<Workout>(`${this.baseUrl}`, workout);
  }

  updateWorkout(id: string, workout: Partial<Workout>): Observable<Workout> {
    return this.http.patch<Workout>(`${this.baseUrl}/${id}`, workout);
  }

  deleteWorkout(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
