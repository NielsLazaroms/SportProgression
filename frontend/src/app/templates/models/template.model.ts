import { ExerciseType } from '../../exercises/models/exercise.model';

/** One planned exercise: do `targetSets` working sets of `targetReps` reps. */
export interface TemplateExercise {
  id: number;
  exerciseDefinitionId?: number | null;
  name: string;
  type: ExerciseType;
  muscleGroup?: string | null;
  orderInTemplate: number;
  targetSets: number;
  targetReps: number;
  /** Neighbouring exercises with the same number form one superset. */
  supersetGroup?: number | null;
}

/** A reusable workout plan. Weights are not part of it: they come from what
 *  the lifter did last time. */
export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating or replacing a template (exercises in order). */
export interface SaveTemplate {
  name: string;
  exercises: {
    exerciseDefinitionId: number;
    targetSets: number;
    targetReps: number;
    supersetGroup?: number | null;
  }[];
}

export function templateSetCount(t: WorkoutTemplate): number {
  return t.exercises.reduce((n, e) => n + e.targetSets, 0);
}
