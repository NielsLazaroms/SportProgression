export interface Workout {
  id: number;
  date: string;
  note: string;
}

export type CreateWorkout = Omit<Workout, 'id'>;
