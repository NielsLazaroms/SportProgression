import { addDays } from './schedule-dates';

/** Shapes of the backend `/schedule` endpoints. */

export interface ScheduledExercise {
  exerciseDefinitionId: number;
  name: string;
  muscleGroup: string | null;
  bodyweight: boolean;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
  supersetGroup: number | null;
}

/** A workout planned for a day. Starting it creates the real workout. */
export interface ScheduledWorkout {
  id: string;
  date: string;
  name: string;
  /** The coach's reason; null when scheduled by hand. */
  note: string | null;
  exercises: ScheduledExercise[];
  /** Set once started: the workout it became. */
  workoutId: string | null;
  createdAt: string;
}

export interface ScheduleItem {
  date: string;
  name: string;
  note?: string;
  exercises: {
    exerciseDefinitionId: number;
    targetSets: number;
    targetReps: number;
    targetWeightKg?: number;
    supersetGroup?: number;
  }[];
}

/**
 * - done: started from the plan;
 * - trained: not started from the plan, but a workout was logged that day;
 * - today / upcoming: still to do;
 * - missed: the day passed without training.
 */
export type ScheduleStatus = 'done' | 'trained' | 'today' | 'upcoming' | 'missed';

export function scheduleStatus(
  item: ScheduledWorkout,
  today: string,
  trainedDates: Set<string>,
): ScheduleStatus {
  if (item.workoutId) return 'done';
  if (item.date === today) return 'today';
  if (item.date > today) return 'upcoming';
  return trainedDates.has(item.date) ? 'trained' : 'missed';
}

/** Same cap as the backend. */
export const MAX_SCHEDULE_ITEMS = 28;

/** How many weeks a schedule can be repeated for in one go. */
export const REPEAT_WEEK_OPTIONS = [1, 2, 3, 4] as const;

/**
 * The same week again for `weeks` weeks, each copy 7 days later. Only the
 * first week keeps the suggested weights: later weights would be guesses, and
 * the logging screen shows last time's sets to beat instead.
 */
export function repeatWeeks(items: ScheduleItem[], weeks: number): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  for (let w = 0; w < Math.max(1, weeks); w++) {
    for (const item of items) {
      out.push({
        ...item,
        date: addDays(item.date, 7 * w),
        exercises: w === 0 ? item.exercises : item.exercises.map(({ targetWeightKg: _kg, ...e }) => e),
      });
    }
  }
  return out;
}
