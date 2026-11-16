/** Shapes of the backend `/goals` endpoints. Progress is worked out from the logged sets. */

export type GoalKind = 'lift' | 'muscle';

interface GoalBase {
  id: string;
  /** "Reach it by", yyyy-mm-dd. */
  targetDate: string | null;
  /** Days from today to the target date; negative once it has passed. */
  daysLeft: number | null;
  note: string | null;
  createdAt: string;
}

export interface GoalSet {
  reps: number;
  weightKg: number;
  date: string;
}

/** One set to reach on one exercise: `targetReps` at `targetWeightKg`. */
export interface LiftGoal extends GoalBase {
  kind: 'lift';
  exerciseDefinitionId: number;
  exerciseName: string;
  muscleGroup: string | null;
  /** The weight is extra weight on top of body weight. */
  bodyweight: boolean;
  targetWeightKg: number;
  targetReps: number;
  progress: {
    /** 0..100; 100 only once a real set met the target. */
    pct: number;
    achieved: boolean;
    achievedOn: string | null;
    /** The set that came closest so far. */
    best: GoalSet | null;
  };
}

/** A number of working sets every week for one muscle group. */
export interface MuscleGoal extends GoalBase {
  kind: 'muscle';
  muscleGroup: string;
  targetSetsPerWeek: number;
  progress: {
    pct: number;
    setsThisWeek: number;
    /** The four weeks before this one, oldest first. */
    setsEarlierWeeks: number[];
  };
}

export type Goal = LiftGoal | MuscleGoal;

export interface SaveGoal {
  kind: GoalKind;
  exerciseDefinitionId?: number;
  targetWeightKg?: number;
  targetReps?: number;
  muscleGroup?: string;
  targetSetsPerWeek?: number;
  targetDate?: string | null;
  note?: string | null;
}

/** Same cap as the backend. */
export const MAX_GOALS = 12;
export const GOAL_NOTE_MAX = 200;
