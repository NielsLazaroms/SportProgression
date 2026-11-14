import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { todayIso } from '../../shared/format';
import { ExerciseHistory, ProgressSummary } from '../models/progress.model';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.backendUrl}/progress`;

  getSummary(): Observable<ProgressSummary> {
    return this.http.get<ProgressSummary>(`${this.baseUrl}/summary`, {
      params: { today: todayIso() },
    });
  }

  /** 404s when the user has never logged a set for this exercise. */
  getExerciseHistory(definitionId: number): Observable<ExerciseHistory> {
    return this.http.get<ExerciseHistory>(
      `${this.baseUrl}/exercises/${definitionId}`,
    );
  }
}
