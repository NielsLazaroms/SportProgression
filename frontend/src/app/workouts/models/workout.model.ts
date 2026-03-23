export interface Workout {
  id: string;
  date: string;
  name: string;
  description?: string;
}

export type CreateWorkout = Omit<Workout, 'id'>;
