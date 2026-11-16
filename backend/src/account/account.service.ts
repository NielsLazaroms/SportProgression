import { Injectable, NotFoundException } from '@nestjs/common';
import { STANDARD_MUSCLE_GROUPS } from '../exercise-definitions/default-exercises';
import { DataSource, In } from 'typeorm';
import {
  EQUIPMENT_LIST,
  GYM_EQUIPMENT,
  cleanEquipment,
  describeEquipment,
} from './gym-equipment';
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

  /**
   * The muscle groups this user can be judged on (the standard ones plus any
   * they have logged), each with whether they chose to train it.
   */
  async muscleGroups(userId: string) {
    const user = await this.dataSource.getRepository(User).findOneBy({ id: userId });
    if (!user) throw new NotFoundException();
    const rows = await this.dataSource
      .getRepository(WorkoutExercise)
      .createQueryBuilder('e')
      .innerJoin('e.workout', 'w')
      .select('DISTINCT e.muscleGroup', 'muscleGroup')
      .where('w.userId = :userId', { userId })
      .andWhere('e.muscleGroup IS NOT NULL')
      .getRawMany<{ muscleGroup: string }>();
    const ignored = new Set(user.ignoredMuscleGroups ?? []);
    const names = [
      ...new Set([
        ...STANDARD_MUSCLE_GROUPS,
        ...rows.map((r) => r.muscleGroup).filter(Boolean).sort(),
        ...ignored,
      ]),
    ];
    return { groups: names.map((name) => ({ name, trained: !ignored.has(name) })) };
  }

  async setIgnoredMuscleGroups(userId: string, ignored: string[]) {
    const clean = [...new Set(ignored.map((g) => g.trim()).filter(Boolean))];
    const result = await this.dataSource
      .getRepository(User)
      .update({ id: userId }, { ignoredMuscleGroups: clean.length ? clean : null });
    if (!result.affected) throw new NotFoundException();
    return this.muscleGroups(userId);
  }

  /** What the AI coach should take into account: preferred weekdays and a free note. */
  async coachPreferences(userId: string) {
    const user = await this.dataSource.getRepository(User).findOneBy({ id: userId });
    if (!user) throw new NotFoundException();
    return {
      trainingDays: [...(user.trainingDays ?? [])].sort((a, b) => a - b),
      note: user.coachNote ?? '',
    };
  }

  async setCoachPreferences(userId: string, trainingDays: number[], note?: string) {
    const days = [...new Set(trainingDays)].sort((a, b) => a - b);
    const result = await this.dataSource
      .getRepository(User)
      .update(
        { id: userId },
        { trainingDays: days.length ? days : null, coachNote: note?.trim() || null },
      );
    if (!result.affected) throw new NotFoundException();
    return this.coachPreferences(userId);
  }

  /**
   * The standard gym equipment with whether the user's gym has it, followed by
   * the other machines they added themselves (always owned).
   */
  async gymEquipment(userId: string) {
    const user = await this.dataSource.getRepository(User).findOneBy({ id: userId });
    if (!user) throw new NotFoundException();
    const owned = new Set(user.gymEquipment ?? []);
    return {
      name: user.gymName ?? '',
      items: [
        ...EQUIPMENT_LIST.map((e) => ({
          name: e.key,
          group: e.group,
          owned: owned.has(e.key),
          custom: false,
        })),
        ...[...owned]
          .filter((name) => !(name in GYM_EQUIPMENT))
          .map((name) => ({ name, group: 'other', owned: true, custom: true })),
      ],
    };
  }

  async setGymEquipment(userId: string, equipment: string[], name?: string) {
    const clean = cleanEquipment(equipment);
    const result = await this.dataSource.getRepository(User).update(
      { id: userId },
      {
        gymEquipment: clean.length ? clean : null,
        ...(name === undefined ? {} : { gymName: name.trim() || null }),
      },
    );
    if (!result.affected) throw new NotFoundException();
    return this.gymEquipment(userId);
  }

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
        ignoredMuscleGroups: user.ignoredMuscleGroups ?? [],
        trainingDays: user.trainingDays ?? [],
        coachNote: user.coachNote ?? null,
        gymName: user.gymName ?? null,
        gymEquipment: describeEquipment(user.gymEquipment) ?? [],
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
          type: e.type,
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
