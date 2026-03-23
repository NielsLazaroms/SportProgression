export enum ExerciseType {
  STRENGTH = 'StrengthExercise',
  RUN = 'RunExercise',
  CYCLING = 'CyclingExercise',
  BODYWEIGHT = 'BodyweightExercise',
}

export interface Exercise {
  exerciseId: number;
  workoutId: string;
  type: ExerciseType;
  name: string;
  orderInWorkout: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExercise {
  type: ExerciseType;
  name: string;
  orderInWorkout: number;
  notes?: string;
  muscleGroup?: string;
}
