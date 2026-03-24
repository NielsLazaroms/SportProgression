import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExerciseSet, CreateSet } from '../models/exercise.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SetService {
  constructor(private http: HttpClient) {}

  private baseUrl(exerciseId: number): string {
    return `${environment.backendUrl}/exercises/${exerciseId}/sets`;
  }

  getSets(exerciseId: number): Observable<ExerciseSet[]> {
    return this.http.get<ExerciseSet[]>(this.baseUrl(exerciseId));
  }

  createSet(exerciseId: number, dto: CreateSet): Observable<ExerciseSet> {
    return this.http.post<ExerciseSet>(this.baseUrl(exerciseId), dto);
  }

  updateSet(exerciseId: number, setId: number, dto: Partial<CreateSet>): Observable<ExerciseSet> {
    return this.http.patch<ExerciseSet>(`${this.baseUrl(exerciseId)}/${setId}`, dto);
  }

  deleteSet(exerciseId: number, setId: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl(exerciseId)}/${setId}`);
  }
}
