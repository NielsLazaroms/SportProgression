import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { User } from '../users/user.entity';
import { Workout } from '../workouts/workouts.entity';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { ExerciseSet } from '../sets/set.entity';
import { ExerciseDefinition } from '../exercise-definitions/exercise-definition.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import {
  TemplateExercise,
  WorkoutTemplate,
} from '../templates/template.entity';

const chunk = <T>(items: T[], size = 500): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

@Injectable()
export class AccountService {
  constructor(private readonly dataSource: DataSource) {}

  /** Everything the app stores about this user, as one portable document. */
  async export(userId: string) {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: userId });
    if (!user) throw new NotFoundException();

    const workouts = await this.dataSource.getRepository(Workout).find({
      where: { userId },
      relations: { exercises: { sets: true } },
      order: {
        date: 'ASC',
        createdAt: 'ASC',
        exercises: { orderInWorkout: 'ASC', sets: { setOrder: 'ASC' } },
      },
    });
    const exercises = await this.dataSource
      .getRepository(ExerciseDefinition)
      .find({ where: { createdByUserId: userId }, order: { name: 'ASC' } });

    const templates = await this.dataSource.getRepository(WorkoutTemplate).find({
      where: { userId },
      relations: { exercises: true },
      order: { name: 'ASC', exercises: { orderInTemplate: 'ASC' } },
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        email: user.email,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        memberSince: user.createdAt,
      },
      myExercises: exercises.map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup ?? null,
      })),
      templates: templates.map((t) => ({
        name: t.name,
        exercises: t.exercises.map((e) => ({
          name: e.name,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
        })),
      })),
      workouts: workouts.map((w) => ({
        date: w.date,
        name: w.name,
        notes: w.description ?? null,
        finishedAt: w.completedAt ?? null,
        exercises: (w.exercises ?? []).map((e) => ({
          name: e.name,
          muscleGroup: e.muscleGroup ?? null,
          notes: e.notes ?? null,
          sets: (e.sets ?? []).map((s) => ({
            reps: s.repsAmount,
            weightKg: s.weightKg,
            warmUp: !!s.isWarmup,
          })),
        })),
      })),
    };
  }

  /**
   * Permanently deletes the account and everything logged under it. Exercises
   * the user added to the shared catalog stay (others may have logged them)
   * but lose their link to the account.
   */
  async delete(userId: string) {
    await this.dataSource.transaction(async (manager) => {
      const workoutIds = (
        await manager.find(Workout, { where: { userId }, select: { id: true } })
      ).map((w) => w.id);

      // Explicit, child-first deletes: correct whether or not the database
      // enforces the foreign-key cascades.
      for (const ids of chunk(workoutIds)) {
        const exerciseIds = (
          await manager.find(WorkoutExercise, {
            where: { workoutId: In(ids) },
            select: { id: true },
          })
        ).map((e) => e.id);
        for (const exIds of chunk(exerciseIds)) {
          await manager.delete(ExerciseSet, { workoutExerciseId: In(exIds) });
          await manager.delete(WorkoutExercise, { id: In(exIds) });
        }
        await manager.delete(Workout, { id: In(ids) });
      }
      const templateIds = (
        await manager.find(WorkoutTemplate, {
          where: { userId },
          select: { id: true },
        })
      ).map((t) => t.id);
      for (const ids of chunk(templateIds)) {
        await manager.delete(TemplateExercise, { templateId: In(ids) });
        await manager.delete(WorkoutTemplate, { id: In(ids) });
      }
      await manager.delete(RefreshToken, { userId });
      await manager.update(
        ExerciseDefinition,
        { createdByUserId: userId },
        { createdByUserId: null as unknown as undefined },
      );
      await manager.delete(User, { id: userId });
    });
    return { deleted: true };
  }
}
