import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/data-access/auth.service';
import { todayIso } from '../shared/format';
import { Workout } from '../workouts/models/workout.model';

/** What a plan can be asked to focus on; the same keys the server knows. */
export const PLAN_FOCUSES = ['legs', 'push', 'pull', 'upper', 'lower', 'full_body'] as const;
export type PlanFocus = (typeof PLAN_FOCUSES)[number];

/** Longest wish the server accepts for one plan. */
export const PLAN_NOTE_MAX = 120;

/** What the user asks for in this one plan: a focus and a short note, both optional. */
export interface PlanRequest {
  focus: PlanFocus | null;
  note: string;
}

export const NO_PLAN_REQUEST: PlanRequest = { focus: null, note: '' };

/** The request as sent to the server: only what was asked. */
function requestBody(r?: PlanRequest): { focus?: PlanFocus; note?: string } {
  const note = r?.note.trim().slice(0, PLAN_NOTE_MAX) ?? '';
  return { ...(r?.focus ? { focus: r.focus } : {}), ...(note ? { note } : {}) };
}

/** Key part for a request, so plans with another focus or note are kept apart. */
function requestKey(r?: PlanRequest): string {
  const body = requestBody(r);
  return body.focus || body.note ? `|ask:${body.focus ?? ''}:${encodeURIComponent(body.note ?? '')}` : '';
}

/** The request back from a key part made by requestKey. */
function parseRequestKey(part: string | undefined): PlanRequest {
  if (!part?.startsWith('ask:')) return { ...NO_PLAN_REQUEST };
  const [, focus, note] = part.split(':');
  return {
    focus: (PLAN_FOCUSES as readonly string[]).includes(focus) ? (focus as PlanFocus) : null,
    note: decodeURIComponent(note ?? ''),
  };
}

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
  /** Week plans only: large muscle groups that get too few sets, with their count. */
  thin?: { group: string; sets: number; target?: number }[];
  /** Week plans only: exercises of open lift goals that the week leaves out. */
  missingGoals?: string[];
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

/** Equipment and whether the user's gym has it. Custom items are machines the user typed in. */
export interface GymEquipmentItem {
  name: string;
  /** Where the app shows it; machines the user typed in are 'other'. */
  group: 'free_weights' | 'stations' | 'legs' | 'upper' | 'other';
  owned: boolean;
  custom: boolean;
}

/** The user's gym: what they call it and what it has. */
export interface MyGym {
  name: string;
  items: GymEquipmentItem[];
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
  /** Workout only: when the saved analysis was written. */
  createdAt?: string;
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
 *  - a workout is analysed once: the server saves it, and opening it again
 *    reads the saved one (never paid twice, also on another device);
 *  - a week analysis is saved the same way, but "Analyse again" writes a new
 *    one over it, because a week changes while it is trained;
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

  myGym(): Observable<MyGym> {
    return this.http.get<MyGym>(`${environment.backendUrl}/account/equipment`);
  }

  /** Saves the gym; stored suggestions are dropped because they may no longer fit. */
  setMyGym(gym: { name: string; equipment: string[] }): Observable<MyGym> {
    return this.http
      .put<MyGym>(`${environment.backendUrl}/account/equipment`, gym)
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
    const url = `${this.baseUrl}/week`;
    // "Analyse again" writes a new one; otherwise the saved one, if any.
    const send = fresh
      ? this.post<AnalysisResult>(url, { today, locale })
      : () => this.savedOr<AnalysisResult>(this.http.get<AnalysisResult>(url, { params: { today } }), url, { today, locale });
    return this.run<AnalysisResult>('a', `week|${today}`, send, fresh);
  }

  /**
   * The analysis of one workout: the saved one when there is one, otherwise
   * it is written (once) and saved. There is no "again" for a workout.
   */
  workout(id: string, locale: string): Observable<AnalysisResult> {
    const url = `${this.baseUrl}/workouts/${id}`;
    const send = () => this.savedOr<AnalysisResult>(this.http.get<AnalysisResult>(url), url, { locale });
    return this.run<AnalysisResult>('a', `workout|${id}`, send, false);
  }

  /** The saved result from `saved`, or, when there is none yet, a new one asked with a POST. */
  private savedOr<T>(saved: Observable<T>, url: string, body: object): Observable<T> {
    return saved.pipe(
      catchError((err: unknown) =>
        err instanceof HttpErrorResponse && err.status === 404 && err.error?.code === 'not_analysed'
          ? this.http.post<T>(url, body)
          : throwError(() => err),
      ),
    );
  }

  /**
   * A proposal for the next workout, or for `date` when scheduling ahead; kept
   * like the analyses (per day it is for, so two days never share one plan).
   */
  suggestWorkout(locale: string, fresh = false, date?: string, request?: PlanRequest): Observable<Suggestion> {
    const today = todayIso();
    const url = `${this.baseUrl}/suggest/workout`;
    const ahead = date && date > today ? date : null;
    const key = (ahead ? `workout|${today}|${locale}|for ${ahead}` : `workout|${today}|${locale}`) + requestKey(request);
    const body = { today, locale, ...(ahead ? { date: ahead } : {}), ...requestBody(request) };
    return this.run<Suggestion>('s', key, this.post(url, body), fresh);
  }

  /** A proposal for a week with `days` training days. */
  suggestWeek(days: number, locale: string, fresh = false, request?: PlanRequest): Observable<Suggestion> {
    const today = todayIso();
    const url = `${this.baseUrl}/suggest/week`;
    const key = `week|${days}|${today}|${locale}` + requestKey(request);
    return this.run<Suggestion>('s', key, this.post(url, { today, locale, days, ...requestBody(request) }), fresh);
  }

  /**
   * The latest plan of this kind asked for today (or being made right now,
   * `running`), with the number of days (week) and what was asked, so
   * reopening the sheet can start from those choices. Workouts for a later day
   * do not count. Null when there is none.
   */
  knownPlan(
    kind: 'week' | 'workout',
    locale: string,
  ): { days: number | null; request: PlanRequest; running: boolean } | null {
    this.sync();
    const today = todayIso();
    const parse = (key: string) => {
      const parts = key.split('|');
      if (parts[0] !== kind) return null;
      const [day, lang, ask] = kind === 'week' ? parts.slice(2) : parts.slice(1);
      if (day !== today || lang !== locale || (ask !== undefined && !ask.startsWith('ask:'))) return null;
      const days = kind === 'week' ? Number(parts[1]) : NaN;
      return { days: Number.isInteger(days) ? days : null, request: parseRequestKey(ask) };
    };
    const running = [...this.inFlight.keys()].filter((k) => k.startsWith('s:')).map((k) => k.slice(2));
    for (const key of running) {
      const known = parse(key);
      if (known) return { ...known, running: true };
    }
    for (const key of [...this.suggestions.keys()].reverse()) {
      const known = parse(key);
      if (known) return { ...known, running: false };
    }
    return null;
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

  /**
   * A workout changed: drop the week analysis kept here, so the next open
   * reads the server's again. The workout's own analysis stays: it is saved
   * once and never written again.
   */
  forgetWorkout(): void {
    this.sync();
    for (const key of [...this.analyses.keys()]) {
      if (key.startsWith('week|')) this.analyses.delete(key);
    }
    for (const key of [...this.inFlight.keys()]) {
      if (key.startsWith('a:week|')) this.inFlight.delete(key);
    }
    this.persist();
  }

  private post<T>(url: string, body: object): () => Observable<T> {
    return () => this.http.post<T>(url, body);
  }

  private run<T extends AnalysisResult | Suggestion>(
    kind: 'a' | 's',
    key: string,
    send: () => Observable<T>,
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
    const request: Observable<T> = send().pipe(
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
