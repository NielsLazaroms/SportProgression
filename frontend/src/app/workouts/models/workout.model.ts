export interface Workout {
  id: string;
  date: string;
  note: string;
}

// TODO look into this if this is the correct way
export type CreateWorkout = Omit<Workout, 'id'>;
