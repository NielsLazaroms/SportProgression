import {
  ExerciseSet,
  WorkoutExercise,
  isBodyweight,
} from '../../exercises/models/exercise.model';

export interface Workout {
  id: string;
  date: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Set once the workout is finished; null/absent while in progress. */
  completedAt?: string | null;
  /** The template this workout was started from, if any. */
  templateId?: string | null;
  /** Present when fetched via the detail endpoint (findOne tree). */
  exercises?: WorkoutExercise[];
}

export function isCompleted(w: Workout | null | undefined): boolean {
  return !!w?.completedAt;
}

export type CreateWorkout = Pick<Workout, 'date' | 'name' | 'description'>;

/** The sets that count: everything except warm-ups. */
export function workingSets(ex: WorkoutExercise): ExerciseSet[] {
  return (ex.sets ?? []).filter((s) => !s.isWarmup);
}

/** Total volume in kg (Σ reps × weight) across all working sets. */
export function workoutVolumeKg(workout: Workout): number {
  return (workout.exercises ?? []).reduce(
    (total, ex) =>
      total +
      workingSets(ex).reduce((s, set) => s + set.repsAmount * set.weightKg, 0),
    0,
  );
}

export function workoutSetCount(workout: Workout): number {
  return (workout.exercises ?? []).reduce(
    (n, ex) => n + workingSets(ex).length,
    0,
  );
}

/**
 * Reps done on bodyweight exercises (working sets). A mixed workout shows them
 * next to its volume, because that work adds little or nothing to the kg total.
 */
export function workoutBodyweightReps(workout: Workout): number {
  return (workout.exercises ?? [])
    .filter((ex) => isBodyweight(ex))
    .reduce(
      (n, ex) => n + workingSets(ex).reduce((r, set) => r + Number(set.repsAmount), 0),
      0,
    );
}

/** Total reps across all working sets (what a bodyweight workout shows instead of volume). */
export function workoutRepCount(workout: Workout): number {
  return (workout.exercises ?? []).reduce(
    (n, ex) => n + workingSets(ex).reduce((r, set) => r + Number(set.repsAmount), 0),
    0,
  );
}
