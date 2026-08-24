import { WorkoutExercise } from '../../exercises/models/exercise.model';

export interface Workout {
  id: string;
  date: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Set once the workout is finished; null/absent while in progress. */
  completedAt?: string | null;
  /** Present when fetched via the detail endpoint (findOne tree). */
  exercises?: WorkoutExercise[];
}

export function isCompleted(w: Workout | null | undefined): boolean {
  return !!w?.completedAt;
}

export type CreateWorkout = Pick<Workout, 'date' | 'name' | 'description'>;

/** Total volume in kg (Σ reps × weight) across all logged sets. */
export function workoutVolumeKg(workout: Workout): number {
  return (workout.exercises ?? []).reduce(
    (total, ex) =>
      total +
      (ex.sets ?? []).reduce((s, set) => s + set.repsAmount * set.weightKg, 0),
    0,
  );
}

export function workoutSetCount(workout: Workout): number {
  return (workout.exercises ?? []).reduce(
    (n, ex) => n + (ex.sets ?? []).length,
    0,
  );
}
