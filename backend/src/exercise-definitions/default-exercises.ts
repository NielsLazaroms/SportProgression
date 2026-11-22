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
  // One exercise for each machine in the gym equipment list that had none,
  // so the coach can plan it when the lifter's gym has that machine.
  { name: 'Smith Machine Squat', muscleGroup: 'Legs' },
  { name: 'Hack Squat', muscleGroup: 'Legs' },
  { name: 'Machine Chest Press', muscleGroup: 'Chest' },
  { name: 'Pec Deck', muscleGroup: 'Chest' },
  { name: 'Machine Row', muscleGroup: 'Back' },
  { name: 'Machine Shoulder Press', muscleGroup: 'Shoulders' },
  { name: 'Machine Crunch', muscleGroup: 'Abs' },
  { name: 'Kettlebell Swing', muscleGroup: 'Glutes' },
  { name: 'Incline Bench Press', muscleGroup: 'Chest' },
  { name: 'Decline Bench Press', muscleGroup: 'Chest' },
  { name: 'Machine Biceps Curl', muscleGroup: 'Biceps' },
  { name: 'Machine Triceps Extension', muscleGroup: 'Triceps' },
  { name: 'Hip Abduction', muscleGroup: 'Glutes' },
  { name: 'Hip Adduction', muscleGroup: 'Legs' },
  { name: 'Back Extension', muscleGroup: 'Back', bodyweight: true },
  { name: 'Wrist Curl', muscleGroup: 'Forearms' },
  { name: 'Reverse Wrist Curl', muscleGroup: 'Forearms' },
  { name: 'Reverse Curl', muscleGroup: 'Forearms' },
];

/** Every muscle group of the starter catalog. */
export const KNOWN_MUSCLE_GROUPS: string[] = [
  ...new Set(
    DEFAULT_EXERCISES.map((e) => e.muscleGroup).filter((g): g is string => !!g),
  ),
];

/**
 * Groups that get plenty of indirect work (rows, curls and deadlifts train the
 * forearms), so they only count for a lifter who trains them on purpose.
 */
export const OPTIONAL_MUSCLE_GROUPS: string[] = ['Forearms'];

/** The muscle groups everyone is judged on. */
export const STANDARD_MUSCLE_GROUPS: string[] = KNOWN_MUSCLE_GROUPS.filter(
  (g) => !OPTIONAL_MUSCLE_GROUPS.includes(g),
);
