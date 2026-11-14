/**
 * Starter catalog inserted when the exercise_definitions table is empty, so a
 * fresh install can log a workout straight away. Rows are created without an
 * owner, which makes them shared and read-only for everyone.
 */
export const DEFAULT_EXERCISES: {
  name: string;
  muscleGroup: string;
  /** Done with your own body weight; any weight logged is EXTRA weight. */
  bodyweight?: boolean;
}[] = [
  { name: 'Bench Press', muscleGroup: 'Chest' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest' },
  { name: 'Cable Fly', muscleGroup: 'Chest' },
  { name: 'Deadlift', muscleGroup: 'Back' },
  { name: 'Barbell Row', muscleGroup: 'Back' },
  { name: 'Lat Pulldown', muscleGroup: 'Back' },
  { name: 'Pull-up', muscleGroup: 'Back', bodyweight: true },
  { name: 'Chin-up', muscleGroup: 'Biceps', bodyweight: true },
  { name: 'Seated Cable Row', muscleGroup: 'Back' },
  { name: 'Overhead Press', muscleGroup: 'Shoulders' },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders' },
  { name: 'Face Pull', muscleGroup: 'Shoulders' },
  { name: 'Barbell Curl', muscleGroup: 'Biceps' },
  { name: 'Hammer Curl', muscleGroup: 'Biceps' },
  { name: 'Triceps Pushdown', muscleGroup: 'Triceps' },
  { name: 'Skull Crusher', muscleGroup: 'Triceps' },
  { name: 'Squat', muscleGroup: 'Legs' },
  { name: 'Leg Press', muscleGroup: 'Legs' },
  { name: 'Leg Extension', muscleGroup: 'Legs' },
  { name: 'Leg Curl', muscleGroup: 'Legs' },
  { name: 'Calf Raise', muscleGroup: 'Legs' },
  { name: 'Romanian Deadlift', muscleGroup: 'Glutes' },
  { name: 'Hip Thrust', muscleGroup: 'Glutes' },
  { name: 'Cable Crunch', muscleGroup: 'Abs' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Abs', bodyweight: true },
  { name: 'Push-up', muscleGroup: 'Chest', bodyweight: true },
  { name: 'Dip', muscleGroup: 'Triceps', bodyweight: true },
];
