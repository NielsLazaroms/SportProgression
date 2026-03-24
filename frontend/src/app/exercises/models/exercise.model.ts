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
  createdByUserId?: string;
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
  notes?: string;
  createdAt: string;
}

export interface CreateSet {
  setOrder: number;
  repsAmount: number;
  weightKg: number;
  notes?: string;
}

export interface CreateWorkoutExercise {
  exerciseDefinitionId: number;
  orderInWorkout: number;
  notes?: string;
}
