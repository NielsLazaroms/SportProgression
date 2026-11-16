import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  ScheduledExercise,
  ScheduledWorkout,
} from './scheduled-workout.entity';
import { ScheduleItemDto } from './schedule.dto';
import {
  ExerciseDefinition,
  ExerciseType,
} from '../exercise-definitions/exercise-definition.entity';
import { WorkoutsService } from '../workouts/workouts.service';
import { daysBetween } from '../goals/goal-progress';

/** The longest window one list call may ask for. */
const MAX_RANGE_DAYS = 62;

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduledWorkout)
    private readonly schedule: Repository<ScheduledWorkout>,
    @InjectRepository(ExerciseDefinition)
    private readonly definitions: Repository<ExerciseDefinition>,
    private readonly workouts: WorkoutsService,
  ) {}

  /** Everything planned from `from` to `to` (inclusive), by date. */
  list(userId: string, from: string, to: string) {
    const span = daysBetween(from, to);
    if (span < 0 || span > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `The range must run forwards and span at most ${MAX_RANGE_DAYS} days`,
      );
    }
    return this.schedule.find({
      where: { userId, date: Between(from, to) },
      order: { date: 'ASC', createdAt: 'ASC' },
    });
  }

  /** Puts workouts on days. Overlapping days are fine: nothing is replaced. */
  async create(userId: string, items: ScheduleItemDto[]) {
    const ids = [
      ...new Set(
        items.flatMap((i) => i.exercises.map((e) => e.exerciseDefinitionId)),
      ),
    ];
    const defs = new Map(
      (await this.definitions.findBy({ id: In(ids) })).map((d) => [d.id, d]),
    );
    const missing = ids.find((id) => !defs.has(id));
    if (missing != null) {
      throw new NotFoundException(
        `Exercise definition with ID ${missing} not found`,
      );
    }
    const rows = items.map((item) =>
      this.schedule.create({
        userId,
        date: item.date,
        name: item.name,
        note: item.note || null,
        workoutId: null,
        exercises: item.exercises.map((e): ScheduledExercise => {
          const def = defs.get(e.exerciseDefinitionId)!;
          return {
            exerciseDefinitionId: def.id,
            name: def.name,
            muscleGroup: def.muscleGroup ?? null,
            bodyweight: def.type === ExerciseType.BODYWEIGHT,
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            targetWeightKg: e.targetWeightKg ?? null,
            supersetGroup: e.supersetGroup ?? null,
          };
        }),
      }),
    );
    return this.schedule.save(rows);
  }

  async move(id: string, userId: string, date: string) {
    const item = await this.find(id, userId);
    item.date = date;
    return this.schedule.save(item);
  }

  async remove(id: string, userId: string) {
    const result = await this.schedule.delete({ id, userId });
    if (!result.affected)
      throw new NotFoundException('Scheduled workout not found');
    return { deleted: true };
  }

  /**
   * Turns the plan into a workout on the user's today and moves the plan to
   * that day, so the week shows it where it was actually done. Pressing it
   * twice returns the same workout.
   */
  async start(id: string, userId: string, today?: string) {
    const item = await this.find(id, userId);
    if (item.workoutId) {
      try {
        return await this.workouts.findOneWithDetails(item.workoutId, userId);
      } catch (err) {
        if (!(err instanceof NotFoundException)) throw err;
      }
    }
    // The snapshot does not stop an exercise from being deleted later on.
    const ids = item.exercises.map((e) => e.exerciseDefinitionId);
    const existing = new Set(
      (await this.definitions.findBy({ id: In(ids) })).map((d) => d.id),
    );
    const exercises = item.exercises.filter((e) =>
      existing.has(e.exerciseDefinitionId),
    );
    if (!exercises.length) {
      throw new UnprocessableEntityException({ code: 'no_exercises' });
    }
    const day = today ?? new Date().toISOString().slice(0, 10);
    const workout = await this.workouts.createPlanned(
      {
        date: day,
        name: item.name,
        exercises: exercises.map((e) => ({
          exerciseDefinitionId: e.exerciseDefinitionId,
          targetSets: e.targetSets,
          targetReps: e.targetReps,
          ...(e.targetWeightKg != null && e.targetWeightKg > 0
            ? { targetWeightKg: e.targetWeightKg }
            : {}),
          ...(e.supersetGroup != null
            ? { supersetGroup: e.supersetGroup }
            : {}),
        })),
      },
      userId,
    );
    item.workoutId = workout.id;
    item.date = day;
    await this.schedule.save(item);
    return workout;
  }

  private async find(id: string, userId: string) {
    const item = await this.schedule.findOneBy({ id, userId });
    if (!item) throw new NotFoundException('Scheduled workout not found');
    return item;
  }
}
