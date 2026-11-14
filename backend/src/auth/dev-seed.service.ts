import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Workout } from '../workouts/workouts.entity';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { ExerciseSet } from '../sets/set.entity';
import { ExerciseDefinition } from '../exercise-definitions/exercise-definition.entity';

const PLAN: { name: string; dayOffset: number; lifts: [string, number][] }[] = [
  {
    name: 'Push Day',
    dayOffset: 0,
    lifts: [
      ['Bench Press', 60],
      ['Overhead Press', 35],
      ['Triceps Pushdown', 25],
    ],
  },
  {
    name: 'Pull Day',
    dayOffset: 2,
    lifts: [
      ['Deadlift', 100],
      ['Barbell Row', 50],
      ['Barbell Curl', 25],
    ],
  },
  {
    name: 'Leg Day',
    dayOffset: 4,
    lifts: [
      ['Squat', 80],
      ['Leg Press', 120],
      ['Calf Raise', 60],
    ],
  },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Local-development helper: gives the demo account eight weeks of realistic
 * training history so the progress views have something to show. Only ever
 * reached through the dev-login route, which is disabled in production.
 */
@Injectable()
export class DevSeedService {
  private readonly logger = new Logger(DevSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async seedIfEmpty(userId: string) {
    const existing = await this.dataSource
      .getRepository(Workout)
      .countBy({ userId });
    if (existing > 0) return;

    const names = PLAN.flatMap((p) => p.lifts.map(([n]) => n));
    const definitions = await this.dataSource
      .getRepository(ExerciseDefinition)
      .findBy({ name: In(names) });
    const byName = new Map(definitions.map((d) => [d.name, d]));

    const now = new Date();
    const today = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );
    const monday = new Date(today);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const WEEKS = 8;

    await this.dataSource.transaction(async (manager) => {
      for (let week = 0; week < WEEKS; week++) {
        for (const day of PLAN) {
          const date = new Date(monday);
          date.setUTCDate(
            date.getUTCDate() - 7 * (WEEKS - 1 - week) + day.dayOffset,
          );
          if (date >= today) continue;

          const workout = await manager.save(
            manager.create(Workout, {
              userId,
              name: day.name,
              date: iso(date),
              description:
                week === WEEKS - 1 ? 'Felt strong, slept well.' : undefined,
              completedAt: new Date(date.getTime() + 19 * 3600 * 1000),
            }),
          );

          let order = 1;
          for (const [liftName, base] of day.lifts) {
            const def = byName.get(liftName);
            if (!def) continue;
            const exercise = await manager.save(
              manager.create(WorkoutExercise, {
                workoutId: workout.id,
                exerciseDefinitionId: def.id,
                name: def.name,
                type: def.type,
                muscleGroup: def.muscleGroup,
                orderInWorkout: order++,
              }),
            );
            // Add weight every other week, add a rep in the weeks between.
            const weight = base + 2.5 * Math.floor(week / 2);
            const topReps = 8 + (week % 2);
            const reps = [topReps, topReps, topReps - 1];
            await manager.save(
              reps.map((r, i) =>
                manager.create(ExerciseSet, {
                  workoutExerciseId: exercise.id,
                  setOrder: i + 1,
                  repsAmount: r,
                  weightKg: weight,
                }),
              ),
            );
          }
        }
      }
    });
    this.logger.log(`Seeded demo training history for user ${userId}`);
  }
}
