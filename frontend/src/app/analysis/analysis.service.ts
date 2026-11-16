import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/data-access/auth.service';
import { todayIso } from '../shared/format';
import { Workout } from '../workouts/models/workout.model';

/** What the coach (Claude) wrote, already split into sections. */
export interface Analysis {
  headline: string;
  summary: string;
  wentWell: string[];
  watchOut: string[];
  nextTime: string[];
}

export interface SuggestedExercise {
  exerciseDefinitionId: number;
  name: string;
  muscleGroup: string | null;
  bodyweight: boolean;
  sets: number;
  reps: number;
  /** Suggested working weight; null only when the log gives no basis for one. */
  weightKg: number | null;
  /** The weight is the coach's starting estimate (the exercise is not in the recent log). */
  weightEstimated?: boolean;
  /** Same number on neighbouring exercises = one superset; null on its own. */
  supersetGroup?: number | null;
}

export interface SuggestedWorkout {
  title: string;
  reason: string;
  /** Week plans only: the weekday Claude proposes for this workout, in the user's language. */
  weekday?: string;
  /** Week plans only: the same day as 1 (Monday) to 7 (Sunday); missing on older answers. */
  weekdayNumber?: number | null;
  exercises: SuggestedExercise[];
}

/** One suggested workout (`plan`) or a suggested week (`summary` + `days`). */
export interface Suggestion {
  scope: 'week' | 'workout';
  /** False when nothing is logged yet: a general starting plan without weights. */
  basedOnHistory?: boolean;
  plan?: SuggestedWorkout;
  summary?: string;
  days?: SuggestedWorkout[];
  /**
   * Client side only: which of the proposed workouts were saved as a template
   * (index in `days`, 0 for a single `plan`), so the same plan is not saved twice.
   */
  savedIndexes?: number[];
  /** Week plans only: muscle groups the lifter trains that the week leaves out. */
  uncovered?: string[];
  /** Client side only: the week was put on the schedule, so it is not scheduled twice. */
  scheduled?: boolean;
}

/** What the AI coach takes into account when planning. */
export interface CoachPreferences {
  /** Preferred training days, 1 = Monday ... 7 = Sunday. */
  trainingDays: number[];
  /** The user's own wishes for how plans should look. */
  note: string;
}

/** A muscle group and whether the user trains it (off = the analysis leaves it alone). */
export interface MuscleGroupChoice {
  name: string;
  trained: boolean;
}

export interface AnalysisResult {
  scope: 'week' | 'workout';
  /** Week only: Monday and Sunday of the analysed week, and how many workouts it holds. */
  from?: string;
  to?: string;
  workouts?: number;
  analysis: Analysis;
}

/** One exercise of a workout started from a suggestion. */
export interface PlannedExercise {
  exerciseDefinitionId: number;
  targetSets: number;
  targetReps: number;
  /** Suggested working weight (for bodyweight exercises: the extra weight). */
  targetWeightKg?: number;
  /** Same number on neighbouring exercises = one superset. */
  supersetGroup?: number;
  /** The planner's one-line reason. Not the user's own note. */
  planNote?: string;
}

/** What is kept in sessionStorage: everything asked today by this user. */
interface Stored {
  day: string;
  user: string;
  analyses: Record<string, AnalysisResult>;
  suggestions: Record<string, Suggestion>;
}

const STORAGE_KEY = 'ironpulse.ai.v1';

/**
 * AI analysis and plans. Every request is a paid call on the server, so:
 *  - a result is kept for the rest of the day (in memory and in
 *    sessionStorage, so a page reload does not ask again);
 *  - while a request is running, asking the same thing again attaches to that
 *    request (closing and reopening a sheet does not start a second one);
 *  - only `fresh` ("Analyse again", "Suggest again", "Plan again") pays again.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.backendUrl}/analysis`;
  private readonly accountUrl = `${environment.backendUrl}/account/muscle-groups`;

  private analyses = new Map<string, AnalysisResult>();
  private suggestions = new Map<string, Suggestion>();
  /** Requests on their way, by the same keys as the results. */
  private readonly inFlight = new Map<string, Observable<unknown>>();
  /** The day and user the kept results belong to. */
  private day = '';
  private user = '';

  coachPreferences(): Observable<CoachPreferences> {
    return this.http.get<CoachPreferences>(`${environment.backendUrl}/account/coach-preferences`);
  }

  /** Saves the preferences; stored suggestions are dropped because they no longer fit. */
  setCoachPreferences(prefs: CoachPreferences): Observable<CoachPreferences> {
    return this.http
      .put<CoachPreferences>(`${environment.backendUrl}/account/coach-preferences`, prefs)
      .pipe(tap(() => this.clearAll()));
  }

  muscleGroups(): Observable<MuscleGroupChoice[]> {
    return this.http.get<{ groups: MuscleGroupChoice[] }>(this.accountUrl).pipe(map((r) => r.groups));
  }

  /** Saves which groups are left out on purpose; stored analyses are dropped because they no longer fit. */
  setIgnoredMuscleGroups(ignored: string[]): Observable<MuscleGroupChoice[]> {
    return this.http.put<{ groups: MuscleGroupChoice[] }>(this.accountUrl, { ignored }).pipe(
      tap(() => this.clearAll()),
      map((r) => r.groups),
    );
  }

  week(locale: string, fresh = false): Observable<AnalysisResult> {
    const today = todayIso();
    return this.run<AnalysisResult>('a', `week|${today}|${locale}`, `${this.baseUrl}/week`, { today, locale }, fresh);
  }

  workout(id: string, locale: string, fresh = false): Observable<AnalysisResult> {
    return this.run<AnalysisResult>('a', `workout|${id}|${locale}`, `${this.baseUrl}/workouts/${id}`, { locale }, fresh);
  }

  /**
   * A proposal for the next workout, or for `date` when scheduling ahead; kept
   * like the analyses (per day it is for, so two days never share one plan).
   */
  suggestWorkout(locale: string, fresh = false, date?: string): Observable<Suggestion> {
    const today = todayIso();
    const url = `${this.baseUrl}/suggest/workout`;
    const ahead = date && date > today ? date : null;
    const key = ahead ? `workout|${today}|${locale}|for ${ahead}` : `workout|${today}|${locale}`;
    return this.run<Suggestion>('s', key, url, { today, locale, ...(ahead ? { date: ahead } : {}) }, fresh);
  }

  /** A proposal for a week with `days` training days. */
  suggestWeek(days: number, locale: string, fresh = false): Observable<Suggestion> {
    const today = todayIso();
    const url = `${this.baseUrl}/suggest/week`;
    return this.run<Suggestion>('s', `week|${days}|${today}|${locale}`, url, { today, locale, days }, fresh);
  }

  /**
   * The number of days of a weekly plan that was already asked for today (or is
   * being made right now), so reopening the sheet shows it without asking
   * "how many days" again. Null when there is none.
   */
  knownWeekDays(locale: string): number | null {
    this.sync();
    const fits = (key: string) => key.startsWith('week|') && key.endsWith(`|${todayIso()}|${locale}`);
    const key =
      [...this.inFlight.keys()].filter((k) => k.startsWith('s:')).map((k) => k.slice(2)).find(fits) ??
      [...this.suggestions.keys()].reverse().find(fits);
    const days = key ? Number(key.split('|')[1]) : NaN;
    return Number.isInteger(days) ? days : null;
  }

  /** Remembers that proposal number `index` of this suggestion became a template. */
  markSaved(suggestion: Suggestion, index: number): void {
    if (!suggestion.savedIndexes?.includes(index)) {
      suggestion.savedIndexes = [...(suggestion.savedIndexes ?? []), index];
    }
    this.persist();
  }

  /** Remembers that this weekly plan was put on the schedule. */
  markScheduled(suggestion: Suggestion): void {
    suggestion.scheduled = true;
    this.persist();
  }

  /** Starts a workout from a proposal: exercises with target sets, reps, weight and the planner's note. */
  startPlanned(plan: { name: string; date: string; exercises: PlannedExercise[] }): Observable<Workout> {
    return this.http.post<Workout>(`${environment.backendUrl}/workouts/planned`, plan);
  }

  /** Forget a stored analysis, e.g. after the workout changed. */
  forgetWorkout(id: string): void {
    this.sync();
    for (const key of [...this.analyses.keys()]) {
      if (key.startsWith(`workout|${id}|`) || key.startsWith('week|')) this.analyses.delete(key);
    }
    for (const key of [...this.inFlight.keys()]) {
      if (key.startsWith(`a:workout|${id}|`) || key.startsWith('a:week|')) this.inFlight.delete(key);
    }
    this.persist();
  }

  private run<T extends AnalysisResult | Suggestion>(
    kind: 'a' | 's',
    key: string,
    url: string,
    body: object,
    fresh: boolean,
  ): Observable<T> {
    this.sync();
    // Looked up again after every sync(): a new day or user replaces the maps.
    const store = () => (kind === 'a' ? this.analyses : this.suggestions) as unknown as Map<string, T>;
    const flightKey = `${kind}:${key}`;
    const running = this.inFlight.get(flightKey) as Observable<T> | undefined;
    if (running) return running;
    const hit = fresh ? undefined : store().get(key);
    if (hit) return of(hit);

    const owner = this.user;
    // refCount false: the request keeps running when the sheet that asked is
    // closed, and a sheet opened later gets the same answer.
    const request: Observable<T> = this.http.post<T>(url, body).pipe(
      tap((result) => {
        if (this.inFlight.get(flightKey) !== request) return; // forgotten meanwhile
        this.sync();
        if (owner !== this.user) return;
        store().delete(key);
        store().set(key, result);
        this.persist();
      }),
      finalize(() => {
        if (this.inFlight.get(flightKey) === request) this.inFlight.delete(flightKey);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inFlight.set(flightKey, request);
    return request;
  }

  private clearAll(): void {
    this.analyses.clear();
    this.suggestions.clear();
    this.inFlight.clear();
    this.persist();
  }

  /**
   * Makes the kept results fit today and the signed-in user: the first call
   * restores them from sessionStorage, a new day or another user drops them.
   */
  private sync(): void {
    const day = todayIso();
    const user = this.auth.profile()?.userId ?? '';
    if (day === this.day && user === this.user) return;
    const first = this.day === '';
    this.day = day;
    this.user = user;
    this.analyses = new Map();
    this.suggestions = new Map();
    this.inFlight.clear();
    const stored = first ? this.read() : null;
    if (stored && stored.day === day && stored.user === user) {
      this.analyses = new Map(Object.entries(stored.analyses ?? {}));
      this.suggestions = new Map(Object.entries(stored.suggestions ?? {}));
    } else {
      this.persist();
    }
  }

  private read(): Stored | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Stored) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      const stored: Stored = {
        day: this.day,
        user: this.user,
        analyses: Object.fromEntries(this.analyses),
        suggestions: Object.fromEntries(this.suggestions),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Private mode or a full store: the results then only live in memory.
    }
  }
}
