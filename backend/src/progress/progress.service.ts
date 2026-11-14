import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workout } from '../workouts/workouts.entity';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { ExerciseType } from '../exercise-definitions/exercise-definition.entity';

/** Estimated one-rep max (Epley). A single rep is the weight itself. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export type RecordKind = 'weight' | 'reps';

/**
 * Is this set a personal record compared with the sets done before it?
 *  - 'weight': heavier than anything lifted before;
 *  - 'reps':   more reps than ever done at this weight or heavier.
 * Every estimated-1RM improvement is one of the two, a true heaviest single
 * counts, and bodyweight (0 kg) exercises get records for more reps.
 * Returns null when there is nothing to compare with.
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

/** Working sets only — warm-ups never count towards any statistic. */
function workingSets(ex: WorkoutExercise) {
  return (ex.sets ?? []).filter((s) => !s.isWarmup);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normalises a `date` column value (string or Date, driver dependent). */
function dateKey(value: string | Date): string {
  if (value instanceof Date) return toIsoDate(value);
  return String(value).slice(0, 10);
}

/** Monday of the week containing the given yyyy-mm-dd date. */
function weekStart(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SessionStats {
  workoutId: string;
  workoutName: string;
  /** When the workout was created — orders several workouts on one day. */
  workoutCreatedAt: Date;
  date: string;
  completed: boolean;
  sets: { setId: number; reps: number; weightKg: number }[];
  topWeightKg: number;
  e1rmKg: number;
  volumeKg: number;
  /** Most reps in a single set — the progress measure for bodyweight work. */
  topReps: number;
  totalReps: number;
  /** True when at least one set of this session was a personal record. */
  isPr: boolean;
  /** The most impressive record set of the session, if any. */
  record: { kind: RecordKind; reps: number; weightKg: number } | null;
}

/**
 * One comparable number per session: best-set reps for a bodyweight exercise,
 * estimated 1RM otherwise. Never mix the two within one exercise.
 */
function sessionScore(s: SessionStats, bodyweight: boolean): number {
  return bodyweight ? s.topReps : s.e1rmKg;
}

/**
 * One entry per workout, oldest first. An exercise that was added twice to the
 * same workout is merged into a single session.
 */
function buildSessions(exercises: WorkoutExercise[]): SessionStats[] {
  const byWorkout = new Map<string, WorkoutExercise[]>();
  for (const ex of exercises) {
    if (!ex.workout || !workingSets(ex).length) continue;
    const list = byWorkout.get(ex.workoutId) ?? [];
    list.push(ex);
    byWorkout.set(ex.workoutId, list);
  }

  const groups = [...byWorkout.values()].sort((a, b) => {
    const byDate = dateKey(a[0].workout.date).localeCompare(
      dateKey(b[0].workout.date),
    );
    if (byDate !== 0) return byDate;
    return (
      new Date(a[0].workout.createdAt).getTime() -
      new Date(b[0].workout.createdAt).getTime()
    );
  });

  const earlier: { reps: number; weightKg: number }[] = [];
  return groups.map((group, index) => {
    const workout = group[0].workout;
    const sets = group
      .sort((a, b) => a.orderInWorkout - b.orderInWorkout)
      .flatMap((ex) =>
        workingSets(ex).sort(
          (a, b) => a.setOrder - b.setOrder || a.setId - b.setId,
        ),
      );
    const topWeightKg = Math.max(...sets.map((s) => s.weightKg));
    const e1rmKg = Math.max(
      ...sets.map((s) => estimateOneRepMax(s.weightKg, s.repsAmount)),
    );
    const volumeKg = sets.reduce((v, s) => v + s.repsAmount * s.weightKg, 0);
    let record: SessionStats['record'] = null;
    for (const s of sets) {
      const set = { reps: s.repsAmount, weightKg: s.weightKg };
      const kind = index > 0 ? recordKind(set, earlier) : null;
      if (
        kind &&
        (!record ||
          set.weightKg > record.weightKg ||
          (set.weightKg === record.weightKg && set.reps > record.reps))
      ) {
        record = { kind, ...set };
      }
      earlier.push(set);
    }
    return {
      workoutId: workout.id,
      workoutName: workout.name,
      workoutCreatedAt: workout.createdAt,
      date: dateKey(workout.date),
      completed: !!workout.completedAt,
      sets: sets.map((s) => ({
        setId: s.setId,
        reps: s.repsAmount,
        weightKg: s.weightKg,
      })),
      topWeightKg: round1(topWeightKg),
      e1rmKg: round1(e1rmKg),
      volumeKg: round1(volumeKg),
      topReps: Math.max(...sets.map((s) => s.repsAmount)),
      totalReps: sets.reduce((n, s) => n + s.repsAmount, 0),
      isPr: !!record,
      record,
    };
  });
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Workout) private workoutRepository: Repository<Workout>,
    @InjectRepository(WorkoutExercise)
    private workoutExerciseRepository: Repository<WorkoutExercise>,
  ) {}

  /** Dashboard data: totals, weekly consistency, per-exercise overview, PRs. */
  async summary(userId: string, clientToday?: string) {
    // A workout without a single logged set was never trained: it must not
    // count towards totals, weekly consistency or the streak.
    const workouts = (
      await this.workoutRepository.find({
        where: { userId },
        relations: { exercises: { sets: true } },
      })
    ).filter((w) => (w.exercises ?? []).some((e) => (e.sets?.length ?? 0) > 0));

    // "Today" is the user's calendar day when the client sends it, so weeks
    // roll over at the user's midnight rather than the server's.
    const today =
      clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
        ? clientToday
        : toIsoDate(new Date());
    const currentWeek = weekStart(today);
    const WEEKS = 12;

    const weeks = new Map<
      string,
      { weekStart: string; workouts: number; sets: number; volumeKg: number }
    >();
    for (let i = WEEKS - 1; i >= 0; i--) {
      const ws = addDays(currentWeek, -7 * i);
      weeks.set(ws, { weekStart: ws, workouts: 0, sets: 0, volumeKg: 0 });
    }

    const totals = { workouts: workouts.length, sets: 0, volumeKg: 0 };
    const activeWeeks = new Set<string>();
    const muscleSince = addDays(today, -30);
    // Muscle balance: in how many workouts was each muscle group trained.
    const muscles = new Map<string, number>();
    const byDefinition = new Map<number, WorkoutExercise[]>();

    for (const workout of workouts) {
      const date = dateKey(workout.date);
      const ws = weekStart(date);
      let sets = 0;
      let volume = 0;
      const trained = new Set<string>();
      for (const ex of workout.exercises ?? []) {
        ex.workout = workout;
        const working = workingSets(ex);
        const count = working.length;
        sets += count;
        volume += working.reduce(
          (v, s) => v + s.repsAmount * s.weightKg,
          0,
        );
        if (count > 0 && ex.muscleGroup && date >= muscleSince) {
          trained.add(ex.muscleGroup);
        }
        if (ex.exerciseDefinitionId != null) {
          const list = byDefinition.get(ex.exerciseDefinitionId) ?? [];
          list.push(ex);
          byDefinition.set(ex.exerciseDefinitionId, list);
        }
      }
      for (const group of trained) {
        muscles.set(group, (muscles.get(group) ?? 0) + 1);
      }
      totals.sets += sets;
      totals.volumeKg += volume;
      activeWeeks.add(ws);
      const bucket = weeks.get(ws);
      if (bucket) {
        bucket.workouts += 1;
        bucket.sets += sets;
        bucket.volumeKg += volume;
      }
    }

    // Consecutive weeks with at least one workout. The current week doesn't
    // break the streak while it's still empty.
    let cursor = activeWeeks.has(currentWeek)
      ? currentWeek
      : addDays(currentWeek, -7);
    let streakWeeks = 0;
    while (activeWeeks.has(cursor)) {
      streakWeeks += 1;
      cursor = addDays(cursor, -7);
    }

    const exercises: {
      exerciseDefinitionId: number;
      name: string;
      muscleGroup: string | null;
      sessions: number;
      lastDate: string;
      bestWeightKg: number;
      bestE1rmKg: number;
      lastE1rmKg: number;
      /** Most reps in one set, ever. */
      bestReps: number;
      /** True when the exercise has only ever been done at 0 kg. */
      bodyweight: boolean;
      trendPct: number | null;
    }[] = [];
    const records: {
      exerciseDefinitionId: number;
      name: string;
      date: string;
      workoutId: string;
      e1rmKg: number;
      topWeightKg: number;
      kind: RecordKind;
      reps: number;
      weightKg: number;
    }[] = [];

    for (const [definitionId, list] of byDefinition) {
      const sessions = buildSessions(list);
      if (!sessions.length) continue;
      const latest = list.reduce((a, b) =>
        new Date(a.createdAt) > new Date(b.createdAt) ? a : b,
      );
      const first = sessions[0];
      const last = sessions[sessions.length - 1];
      // A bodyweight exercise, or one only ever done without weight.
      const bodyweight =
        latest.type === ExerciseType.BODYWEIGHT ||
        sessions.every((s) => s.topWeightKg === 0);
      exercises.push({
        exerciseDefinitionId: definitionId,
        name: latest.name,
        muscleGroup: latest.muscleGroup ?? null,
        sessions: sessions.length,
        lastDate: last.date,
        bestWeightKg: Math.max(...sessions.map((s) => s.topWeightKg)),
        bestE1rmKg: Math.max(...sessions.map((s) => s.e1rmKg)),
        lastE1rmKg: last.e1rmKg,
        bestReps: Math.max(...sessions.map((s) => s.topReps)),
        bodyweight,
        trendPct:
          sessions.length > 1 && sessionScore(first, bodyweight) > 0
            ? round1(
                ((sessionScore(last, bodyweight) -
                  sessionScore(first, bodyweight)) /
                  sessionScore(first, bodyweight)) *
                  100,
              )
            : null,
      });
      for (const s of sessions) {
        if (s.record) {
          records.push({
            exerciseDefinitionId: definitionId,
            name: latest.name,
            date: s.date,
            workoutId: s.workoutId,
            e1rmKg: s.e1rmKg,
            topWeightKg: s.topWeightKg,
            ...s.record,
          });
        }
      }
    }

    exercises.sort(
      (a, b) =>
        b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name),
    );
    records.sort((a, b) => b.date.localeCompare(a.date));

    const week = weeks.get(currentWeek)!;
    return {
      totals: { ...totals, volumeKg: round1(totals.volumeKg) },
      thisWeek: {
        workouts: week.workouts,
        sets: week.sets,
        volumeKg: round1(week.volumeKg),
      },
      streakWeeks,
      weekly: [...weeks.values()].map((w) => ({
        ...w,
        volumeKg: round1(w.volumeKg),
      })),
      muscleGroups: [...muscles.entries()]
        .map(([muscleGroup, workouts]) => ({ muscleGroup, workouts }))
        .sort(
          (a, b) =>
            b.workouts - a.workouts ||
            a.muscleGroup.localeCompare(b.muscleGroup),
        ),
      exercises,
      recentRecords: records.slice(0, 5),
    };
  }

  /** Full chronological history + all-time records for one catalog exercise. */
  async exerciseHistory(definitionId: number, userId: string) {
    const list = await this.workoutExerciseRepository.find({
      where: { exerciseDefinitionId: definitionId, workout: { userId } },
      relations: { workout: true, sets: true },
    });
    if (!list.length) {
      throw new NotFoundException(
        `No logged history for exercise ${definitionId}`,
      );
    }

    const latest = list.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b,
    );
    const sessions = buildSessions(list);

    let maxWeight: {
      weightKg: number;
      reps: number;
      date: string;
      workoutId: string;
    } | null = null;
    let bestE1rm: {
      e1rmKg: number;
      weightKg: number;
      reps: number;
      date: string;
      workoutId: string;
    } | null = null;
    let bestVolume: { volumeKg: number; date: string; workoutId: string } | null =
      null;
    let mostReps: {
      reps: number;
      weightKg: number;
      date: string;
      workoutId: string;
    } | null = null;

    for (const s of sessions) {
      if (!bestVolume || s.volumeKg > bestVolume.volumeKg) {
        bestVolume = {
          volumeKg: s.volumeKg,
          date: s.date,
          workoutId: s.workoutId,
        };
      }
      for (const set of s.sets) {
        if (
          !maxWeight ||
          set.weightKg > maxWeight.weightKg ||
          (set.weightKg === maxWeight.weightKg && set.reps > maxWeight.reps)
        ) {
          maxWeight = {
            weightKg: set.weightKg,
            reps: set.reps,
            date: s.date,
            workoutId: s.workoutId,
          };
        }
        if (
          !mostReps ||
          set.reps > mostReps.reps ||
          (set.reps === mostReps.reps && set.weightKg > mostReps.weightKg)
        ) {
          mostReps = {
            reps: set.reps,
            weightKg: set.weightKg,
            date: s.date,
            workoutId: s.workoutId,
          };
        }
        const e = round1(estimateOneRepMax(set.weightKg, set.reps));
        if (!bestE1rm || e > bestE1rm.e1rmKg) {
          bestE1rm = {
            e1rmKg: e,
            weightKg: set.weightKg,
            reps: set.reps,
            date: s.date,
            workoutId: s.workoutId,
          };
        }
      }
    }

    return {
      exerciseDefinitionId: definitionId,
      name: latest.name,
      muscleGroup: latest.muscleGroup ?? null,
      /** True for bodyweight exercises: weights are extra weight. */
      bodyweight: latest.type === ExerciseType.BODYWEIGHT,
      records: { maxWeight, bestE1rm, bestVolume, mostReps },
      sessions,
    };
  }
}
