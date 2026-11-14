/** Shapes returned by the backend `/progress` endpoints. */

/** 'weight' = heavier than ever; 'reps' = most reps at that weight or heavier. */
export type RecordKind = 'weight' | 'reps';

export interface ProgressTotals {
  workouts: number;
  sets: number;
  volumeKg: number;
}

export interface ProgressWeek extends ProgressTotals {
  /** Monday of the week, yyyy-mm-dd. */
  weekStart: string;
}

export interface ExerciseOverview {
  exerciseDefinitionId: number;
  name: string;
  muscleGroup: string | null;
  /** Number of workouts in which this exercise was logged. */
  sessions: number;
  lastDate: string;
  bestWeightKg: number;
  bestE1rmKg: number;
  lastE1rmKg: number;
  /** Most reps in one set, ever. */
  bestReps: number;
  /** A bodyweight exercise (or only ever done at 0 kg): lead with reps, not kg. */
  bodyweight: boolean;
  /**
   * Change first → latest session in % (estimated 1RM; best-set reps for
   * bodyweight exercises). Null with fewer than 2 sessions.
   */
  trendPct: number | null;
}

export interface RecentRecord {
  exerciseDefinitionId: number;
  name: string;
  date: string;
  workoutId: string;
  e1rmKg: number;
  topWeightKg: number;
  /** The record set itself. */
  kind: RecordKind;
  reps: number;
  weightKg: number;
}

export interface ProgressSummary {
  totals: ProgressTotals;
  thisWeek: ProgressTotals;
  /** Consecutive weeks with at least one workout. */
  streakWeeks: number;
  /** Last 12 weeks, oldest first (always 12 entries, zero-filled). */
  weekly: ProgressWeek[];
  /** Workouts in which each muscle group was trained, last 30 days, most first. */
  muscleGroups: { muscleGroup: string; workouts: number }[];
  /** Every exercise with logged sets, most recently trained first. */
  exercises: ExerciseOverview[];
  /** Up to 5 most recent sessions that contained a personal record. */
  recentRecords: RecentRecord[];
}

export interface ExerciseSession {
  workoutId: string;
  workoutName: string;
  /** ISO timestamp; orders several workouts logged on the same day. */
  workoutCreatedAt: string;
  date: string;
  completed: boolean;
  sets: { setId: number; reps: number; weightKg: number }[];
  topWeightKg: number;
  /** Best estimated 1RM (Epley) of the session. */
  e1rmKg: number;
  volumeKg: number;
  /** Most reps in a single set (the progress measure for bodyweight work). */
  topReps: number;
  totalReps: number;
  /** True when at least one set of the session was a personal record. */
  isPr: boolean;
  /** The session's most impressive record set, if any. */
  record: { kind: RecordKind; reps: number; weightKg: number } | null;
}

export interface ExerciseHistory {
  exerciseDefinitionId: number;
  name: string;
  muscleGroup: string | null;
  /** Bodyweight exercise: logged weights are EXTRA weight on top of body weight. */
  bodyweight: boolean;
  records: {
    maxWeight: { weightKg: number; reps: number; date: string; workoutId: string } | null;
    bestE1rm: {
      e1rmKg: number;
      weightKg: number;
      reps: number;
      date: string;
      workoutId: string;
    } | null;
    bestVolume: { volumeKg: number; date: string; workoutId: string } | null;
    mostReps: { reps: number; weightKg: number; date: string; workoutId: string } | null;
  };
  /** Chronological, oldest first. Working sets only (warm-ups are left out). */
  sessions: ExerciseSession[];
}

/** Estimated one-rep max (Epley) — must match the backend formula. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * Is this set a personal record compared with the sets done before it?
 *  - 'weight': heavier than anything lifted before;
 *  - 'reps':   more reps than ever done at this weight or heavier.
 * Every estimated-1RM improvement is one of the two, a true heaviest single
 * counts, and bodyweight (0 kg) exercises get records for more reps.
 * Returns null when there is nothing to compare with. Must match the backend.
 */
export function recordKind(
  set: { reps: number; weightKg: number },
  earlier: { reps: number; weightKg: number }[],
): RecordKind | null {
  if (!earlier.length || set.reps <= 0) return null;
  let maxWeight = -Infinity;
  let bestRepsAtOrAbove = 0;
  for (const e of earlier) {
    if (e.weightKg > maxWeight) maxWeight = e.weightKg;
    if (e.weightKg >= set.weightKg && e.reps > bestRepsAtOrAbove) {
      bestRepsAtOrAbove = e.reps;
    }
  }
  if (set.weightKg > maxWeight) return 'weight';
  if (set.reps > bestRepsAtOrAbove) return 'reps';
  return null;
}
