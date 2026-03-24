import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExerciseDefinition, CreateExerciseDefinition } from '../models/exercise.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExerciseDefinitionService {
  private readonly baseUrl = `${environment.backendUrl}/exercise-definitions`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ExerciseDefinition[]> {
    return this.http.get<ExerciseDefinition[]>(this.baseUrl);
  }

  getOne(id: number): Observable<ExerciseDefinition> {
    return this.http.get<ExerciseDefinition>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateExerciseDefinition): Observable<ExerciseDefinition> {
    return this.http.post<ExerciseDefinition>(this.baseUrl, dto);
  }

  update(id: number, dto: Partial<CreateExerciseDefinition>): Observable<ExerciseDefinition> {
    return this.http.patch<ExerciseDefinition>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
