import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Workout} from '../models/workout.model'

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly baseUrl = 'http://localhost:3000';
  constructor(private http: HttpClient) {}

  getWorkouts(): Observable<Workout[]> {
    return this.http.get<Workout[]>(`${this.baseUrl}/workouts`);
  }
}
