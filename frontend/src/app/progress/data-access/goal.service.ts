import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { todayIso } from '../../shared/format';
import { Goal, SaveGoal } from '../models/goal.model';

/** Goals of the signed-in user. Saving returns the whole updated list. */
@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.backendUrl}/goals`;

  /** "Today" is the user's day, so weeks and days left follow their midnight. */
  private params() {
    return { today: todayIso() };
  }

  getAll(): Observable<Goal[]> {
    return this.http.get<Goal[]>(this.baseUrl, { params: this.params() });
  }

  create(dto: SaveGoal): Observable<Goal[]> {
    return this.http.post<Goal[]>(this.baseUrl, dto, { params: this.params() });
  }

  update(id: string, dto: SaveGoal): Observable<Goal[]> {
    return this.http.put<Goal[]>(`${this.baseUrl}/${id}`, dto, { params: this.params() });
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
