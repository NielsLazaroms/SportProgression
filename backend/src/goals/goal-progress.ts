import { estimateOneRepMax } from '../progress/progress.service';

/** One working set (never a warm-up) of the goal's exercise. */
export interface GoalSet {
  reps: number;
  weightKg: number;
  /** yyyy-mm-dd of the workout. */
  date: string;
}

export interface LiftProgress {
  /** 0..100. Only 100 once a single set meets both the weight and the reps. */
  pct: number;
  achieved: boolean;
  /** First day a set met the target. */
  achievedOn: string | null;
  /** The set that came closest (or the one that did it). */
  best: GoalSet | null;
}

export interface MuscleProgress {
  /** 0..100: this week's sets against the weekly target. */
  pct: number;
  setsThisWeek: number;
  /** The four weeks before this one, oldest first. */
  setsEarlierWeeks: number[];
}

/** Weeks before this one that a muscle goal looks back on. */
export const MUSCLE_WEEKS_BACK = 4;

/**
 * How close the lifter is to doing `target.reps` at `target.weightKg`.
 *
 * Weighted exercises compare estimated 1RMs, so a heavy triple counts towards
 * a 5 rep goal. Bodyweight work (or a 0 kg target) compares reps, scaled down
 * when the extra weight is below the target. The estimate can overshoot (a set
 * of 10 at 80 kg beats 100 kg for 1 on paper), so the bar stays below 100
 * until a real set at the target weight and reps is logged.
 */
export function liftProgress(
  target: { weightKg: number; reps: number },
  sets: GoalSet[],
  bodyweight: boolean,
): LiftProgress {
  const ordered = [...sets].sort((a, b) => a.date.localeCompare(b.date));
  const meets = (s: GoalSet) =>
    s.weightKg >= target.weightKg && s.reps >= target.reps;
  const done = ordered.find(meets) ?? null;

  const byReps = bodyweight || target.weightKg <= 0;
  const targetE1rm = estimateOneRepMax(target.weightKg, target.reps);
  const score = (s: GoalSet) => {
    if (byReps) {
      const weightPart =
        target.weightKg > 0 ? Math.min(1, s.weightKg / target.weightKg) : 1;
      return weightPart * Math.min(1, s.reps / target.reps);
    }
    return targetE1rm > 0
      ? estimateOneRepMax(s.weightKg, s.reps) / targetE1rm
      : 0;
  };

  let best: GoalSet | null = null;
  let bestScore = 0;
  for (const s of ordered) {
    const sc = score(s);
    // Latest set wins a tie, so "best so far" shows the most recent proof.
    if (sc > 0 && sc >= bestScore) {
      best = s;
      bestScore = sc;
    }
  }

  if (done) {
    return { pct: 100, achieved: true, achievedOn: done.date, best: done };
  }
  return {
    pct: Math.max(0, Math.min(99, Math.floor(bestScore * 100))),
    achieved: false,
    achievedOn: null,
    best,
  };
}

/**
 * Working sets per week for a muscle goal. `weeks` holds this week last and
 * the earlier weeks before it, as counted by `weeklySets`.
 */
export function muscleProgress(
  targetSetsPerWeek: number,
  weeks: number[],
): MuscleProgress {
  const setsThisWeek = weeks[weeks.length - 1] ?? 0;
  return {
    pct: Math.min(
      100,
      Math.round((setsThisWeek / Math.max(1, targetSetsPerWeek)) * 100),
    ),
    setsThisWeek,
    setsEarlierWeeks: weeks.slice(0, -1),
  };
}

/**
 * Counts entries into week buckets: index 0 is `weeksBack` weeks before the
 * week of `monday`, the last index is that week itself. Dates outside the
 * window are ignored.
 */
export function weeklySets(
  entries: { date: string; sets: number }[],
  monday: string,
  weeksBack: number,
): number[] {
  const counts = Array<number>(weeksBack + 1).fill(0);
  const first = addDays(monday, -7 * weeksBack);
  for (const e of entries) {
    const index = Math.floor(daysBetween(first, e.date) / 7);
    if (index >= 0 && index <= weeksBack) counts[index] += e.sets;
  }
  return counts;
}

export function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() -
      new Date(`${from}T00:00:00Z`).getTime()) /
      86400000,
  );
}
