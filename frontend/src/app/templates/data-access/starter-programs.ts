/**
 * Ready-made programs a new user can add with one tap. Each workout becomes
 * one of their own templates. Exercises are named as in the shared starter
 * catalog; an exercise the catalog does not have is left out when adding.
 *
 * Built on the training research in reports/: about 10 to 16 working sets per
 * muscle group per week, each group trained twice where the split allows,
 * compounds first at 5 to 10 reps, isolations after at 10 to 15.
 */
export interface StarterWorkout {
  /** i18n key of the template name. */
  name: string;
  exercises: { name: string; sets: number; reps: number }[];
}

export interface StarterProgram {
  id: 'full_body' | 'upper_lower' | 'ppl';
  /** i18n keys. */
  title: string;
  hint: string;
  badge: string;
  /** Training days when the user has not picked their own (1 = Monday ... 7 = Sunday). */
  defaultDays: number[];
  /** The workouts, in the order they rotate through the training days. */
  workouts: StarterWorkout[];
}

export const STARTER_PROGRAMS: StarterProgram[] = [
  {
    id: 'full_body',
    title: 'programs.full_body',
    hint: 'programs.full_body.hint',
    badge: 'programs.badge.beginner',
    defaultDays: [1, 3, 5],
    workouts: [
      {
        name: 'programs.workout.full_a',
        exercises: [
          { name: 'Squat', sets: 3, reps: 8 },
          { name: 'Bench Press', sets: 3, reps: 8 },
          { name: 'Barbell Row', sets: 3, reps: 10 },
          { name: 'Lateral Raise', sets: 3, reps: 12 },
          { name: 'Barbell Curl', sets: 2, reps: 12 },
          { name: 'Cable Crunch', sets: 2, reps: 12 },
        ],
      },
      {
        name: 'programs.workout.full_b',
        exercises: [
          { name: 'Romanian Deadlift', sets: 3, reps: 8 },
          { name: 'Overhead Press', sets: 3, reps: 8 },
          { name: 'Lat Pulldown', sets: 3, reps: 10 },
          { name: 'Leg Press', sets: 3, reps: 10 },
          { name: 'Triceps Pushdown', sets: 2, reps: 12 },
          { name: 'Calf Raise', sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: 'upper_lower',
    title: 'programs.upper_lower',
    hint: 'programs.upper_lower.hint',
    badge: 'programs.badge.days4',
    defaultDays: [1, 2, 4, 5],
    workouts: [
      {
        name: 'programs.workout.upper_a',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: 6 },
          { name: 'Barbell Row', sets: 4, reps: 8 },
          { name: 'Overhead Press', sets: 3, reps: 8 },
          { name: 'Lat Pulldown', sets: 3, reps: 10 },
          { name: 'Barbell Curl', sets: 2, reps: 12 },
          { name: 'Triceps Pushdown', sets: 2, reps: 12 },
        ],
      },
      {
        name: 'programs.workout.lower_a',
        exercises: [
          { name: 'Squat', sets: 4, reps: 6 },
          { name: 'Romanian Deadlift', sets: 3, reps: 8 },
          { name: 'Leg Curl', sets: 3, reps: 10 },
          { name: 'Leg Extension', sets: 3, reps: 12 },
          { name: 'Calf Raise', sets: 3, reps: 12 },
          { name: 'Hanging Leg Raise', sets: 3, reps: 10 },
        ],
      },
      {
        name: 'programs.workout.upper_b',
        exercises: [
          { name: 'Overhead Press', sets: 4, reps: 6 },
          { name: 'Pull-up', sets: 4, reps: 8 },
          { name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
          { name: 'Seated Cable Row', sets: 3, reps: 10 },
          { name: 'Lateral Raise', sets: 3, reps: 12 },
          { name: 'Hammer Curl', sets: 2, reps: 12 },
        ],
      },
      {
        name: 'programs.workout.lower_b',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: 5 },
          { name: 'Leg Press', sets: 3, reps: 10 },
          { name: 'Hip Thrust', sets: 3, reps: 10 },
          { name: 'Leg Curl', sets: 3, reps: 12 },
          { name: 'Calf Raise', sets: 3, reps: 15 },
          { name: 'Cable Crunch', sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: 'ppl',
    title: 'programs.ppl',
    hint: 'programs.ppl.hint',
    badge: 'programs.badge.days3',
    defaultDays: [1, 3, 5],
    workouts: [
      {
        name: 'programs.workout.push',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: 6 },
          { name: 'Overhead Press', sets: 3, reps: 8 },
          { name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
          { name: 'Lateral Raise', sets: 3, reps: 12 },
          { name: 'Triceps Pushdown', sets: 3, reps: 12 },
        ],
      },
      {
        name: 'programs.workout.pull',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: 5 },
          { name: 'Lat Pulldown', sets: 3, reps: 10 },
          { name: 'Seated Cable Row', sets: 3, reps: 10 },
          { name: 'Face Pull', sets: 3, reps: 15 },
          { name: 'Barbell Curl', sets: 3, reps: 10 },
          { name: 'Hammer Curl', sets: 2, reps: 12 },
        ],
      },
      {
        name: 'programs.workout.legs',
        exercises: [
          { name: 'Squat', sets: 4, reps: 6 },
          { name: 'Romanian Deadlift', sets: 3, reps: 8 },
          { name: 'Leg Press', sets: 3, reps: 10 },
          { name: 'Leg Curl', sets: 3, reps: 12 },
          { name: 'Calf Raise', sets: 3, reps: 15 },
          { name: 'Cable Crunch', sets: 3, reps: 12 },
        ],
      },
    ],
  },
];

/** yyyy-mm-dd of `iso` plus `n` days (calendar days, no time zone shifts). */
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

/** 1 = Monday ... 7 = Sunday. */
function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/**
 * The coming seven days (from `today`) laid out for a program: which workout
 * goes on which date. Uses the user's preferred days when they picked at
 * least as many as the program needs, otherwise the program's own days.
 * Workouts rotate in order (A, B, A for a two-workout program on three days).
 */
export function planFirstWeek(
  program: StarterProgram,
  today: string,
  preferredDays: number[],
): { date: string; workout: number }[] {
  const need = program.defaultDays.length;
  const days = preferredDays.length >= need ? [...preferredDays].sort((a, b) => a - b).slice(0, need) : program.defaultDays;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => days.includes(weekday(d)));
  return dates.map((date, i) => ({ date, workout: i % program.workouts.length }));
}
