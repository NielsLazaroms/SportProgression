export enum ExerciseType {
  STRENGTH = 'StrengthExercise',
  RUN = 'RunExercise',
  CYCLING = 'CyclingExercise',
  BODYWEIGHT = 'BodyweightExercise',
}

export interface ExerciseDefinition {
  id: number;
  name: string;
  type: ExerciseType;
  muscleGroup?: string;
  /** True when the signed-in user created this entry (may edit/delete it). */
  mine?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExerciseDefinition {
  name: string;
  type: ExerciseType;
  muscleGroup?: string;
}

export interface WorkoutExercise {
  id: number;
  workoutId: string;
  exerciseDefinitionId?: number;
  name: string;
  type: ExerciseType;
  muscleGroup?: string;
  orderInWorkout: number;
  notes?: string;
  /** Neighbouring exercises with the same number form one superset. */
  supersetGroup?: number | null;
  /** Planned working sets × reps when the workout came from a template. */
  targetSets?: number | null;
  targetReps?: number | null;
  sets: ExerciseSet[];
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseSet {
  setId: number;
  workoutExerciseId: number;
  setOrder: number;
  repsAmount: number;
  weightKg: number;
  /** Warm-up sets are shown but never count towards stats or records. */
  isWarmup?: boolean;
  notes?: string;
  createdAt: string;
}

export interface CreateSet {
  setOrder: number;
  repsAmount: number;
  weightKg: number;
  isWarmup?: boolean;
  notes?: string;
}

export interface CreateWorkoutExercise {
  exerciseDefinitionId: number;
  orderInWorkout: number;
  notes?: string;
}

/** Bodyweight exercise: a set's weight is EXTRA weight (0 = just body weight). */
export function isBodyweight(e: { type?: ExerciseType | string | null } | null | undefined): boolean {
  return e?.type === ExerciseType.BODYWEIGHT;
}
