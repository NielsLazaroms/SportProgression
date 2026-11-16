import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { todayIso } from '../shared/format';
import { Workout } from '../workouts/models/workout.model';
import { addDays } from './schedule-dates';
import { ScheduleItem, ScheduledWorkout } from './schedule.model';

/** How far back missed plans are still shown, and how far ahead is loaded. */
const DAYS_BACK = 14;
const DAYS_AHEAD = 42;

/**
 * The user's schedule, shared by Home, the coach sheet and Templates so a
 * change in one place shows everywhere at once.
 */
@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.backendUrl}/schedule`;

  /** Everything from two weeks back to six weeks ahead, by date. */
  readonly items = signal<ScheduledWorkout[]>([]);
  readonly loaded = signal(false);

  load(): void {
    const today = todayIso();
    this.http
      .get<ScheduledWorkout[]>(this.baseUrl, {
        params: { from: addDays(today, -DAYS_BACK), to: addDays(today, DAYS_AHEAD) },
      })
      .subscribe({
        next: (list) => {
          this.items.set(list);
          this.loaded.set(true);
        },
        // The schedule is extra: Home works without it.
        error: () => this.loaded.set(true),
      });
  }

  /** Any window of at most 62 days (the calendar's month grid); does not touch `items`. */
  range(from: string, to: string): Observable<ScheduledWorkout[]> {
    return this.http.get<ScheduledWorkout[]>(this.baseUrl, { params: { from, to } });
  }

  create(items: ScheduleItem[]): Observable<ScheduledWorkout[]> {
    return this.http
      .post<ScheduledWorkout[]>(this.baseUrl, { items })
      .pipe(tap((created) => this.items.update((list) => sortByDate([...list, ...created]))));
  }

  move(id: string, date: string): Observable<ScheduledWorkout> {
    return this.http
      .patch<ScheduledWorkout>(`${this.baseUrl}/${id}`, { date })
      .pipe(tap((moved) => this.replace(moved)));
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http
      .delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`)
      .pipe(tap(() => this.items.update((list) => list.filter((i) => i.id !== id))));
  }

  /** Creates the workout today; the plan moves to today and counts as done. */
  start(id: string): Observable<Workout> {
    const today = todayIso();
    return this.http.post<Workout>(`${this.baseUrl}/${id}/start`, { today }).pipe(
      tap((workout) =>
        this.items.update((list) =>
          sortByDate(list.map((i) => (i.id === id ? { ...i, date: today, workoutId: workout.id } : i))),
        ),
      ),
    );
  }

  private replace(item: ScheduledWorkout): void {
    this.items.update((list) => sortByDate(list.map((i) => (i.id === item.id ? item : i))));
  }
}

function sortByDate(list: ScheduledWorkout[]): ScheduledWorkout[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
