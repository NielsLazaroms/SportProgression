import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Goal, GoalKind } from './goal.entity';
import { SaveGoalDto } from './goal.dto';
import {
  ExerciseDefinition,
  ExerciseType,
} from '../exercise-definitions/exercise-definition.entity';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { Workout } from '../workouts/workouts.entity';
import {
  GoalSet,
  LiftProgress,
  MUSCLE_WEEKS_BACK,
  MuscleProgress,
  addDays,
  daysBetween,
  liftProgress,
  mondayOf,
  muscleProgress,
  weeklySets,
} from './goal-progress';

/** Everything goes into the coach's prompt too, so keep the list short. */
export const MAX_GOALS = 12;

const round1 = (n: number) => Math.round(n * 10) / 10;

interface GoalViewBase {
  id: string;
  targetDate: string | null;
  /** Days from today to the target date (negative once it has passed). */
  daysLeft: number | null;
  note: string | null;
  createdAt: Date;
}

export interface LiftGoalView extends GoalViewBase {
  kind: GoalKind.LIFT;
  exerciseDefinitionId: number;
  exerciseName: string;
  muscleGroup: string | null;
  bodyweight: boolean;
  targetWeightKg: number;
  targetReps: number;
  progress: LiftProgress;
}

export interface MuscleGoalView extends GoalViewBase {
  kind: GoalKind.MUSCLE;
  muscleGroup: string;
  targetSetsPerWeek: number;
  progress: MuscleProgress;
}

export type GoalView = LiftGoalView | MuscleGoalView;

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal) private readonly goals: Repository<Goal>,
    @InjectRepository(ExerciseDefinition)
    private readonly definitions: Repository<ExerciseDefinition>,
    @InjectRepository(WorkoutExercise)
    private readonly exercises: Repository<WorkoutExercise>,
    @InjectRepository(Workout) private readonly workouts: Repository<Workout>,
  ) {}

  /** All goals of the user with their progress, unfinished first, then oldest first. */
  async list(userId: string, today?: string): Promise<GoalView[]> {
    const day = today ?? new Date().toISOString().slice(0, 10);
    const goals = await this.goals.find({
      where: { userId },
      relations: { exerciseDefinition: true },
      order: { createdAt: 'ASC' },
    });
    if (!goals.length) return [];

    const liftSets = await this.liftSets(
      userId,
      goals
        .filter((g) => g.kind === GoalKind.LIFT)
        .map((g) => g.exerciseDefinitionId!),
    );
    const monday = mondayOf(day);
    const muscleWeeks = goals.some((g) => g.kind === GoalKind.MUSCLE)
      ? await this.muscleWeeks(userId, monday)
      : new Map<string, number[]>();

    const views = goals.flatMap((g): GoalView[] => {
      const base: GoalViewBase = {
        id: g.id,
        targetDate: g.targetDate ?? null,
        daysLeft: g.targetDate ? daysBetween(day, g.targetDate) : null,
        note: g.note || null,
        createdAt: g.createdAt,
      };
      if (g.kind === GoalKind.LIFT) {
        const def = g.exerciseDefinition;
        if (!def) return [];
        const bodyweight = def.type === ExerciseType.BODYWEIGHT;
        const target = {
          weightKg: g.targetWeightKg ?? 0,
          reps: g.targetReps ?? 1,
        };
        return [
          {
            ...base,
            kind: GoalKind.LIFT,
            exerciseDefinitionId: def.id,
            exerciseName: def.name,
            muscleGroup: def.muscleGroup ?? null,
            bodyweight,
            targetWeightKg: target.weightKg,
            targetReps: target.reps,
            progress: liftProgress(
              target,
              liftSets.get(def.id) ?? [],
              bodyweight,
            ),
          },
        ];
      }
      const group = g.muscleGroup ?? '';
      const target = g.targetSetsPerWeek ?? 1;
      return [
        {
          ...base,
          kind: GoalKind.MUSCLE,
          muscleGroup: group,
          targetSetsPerWeek: target,
          progress: muscleProgress(
            target,
            muscleWeeks.get(group) ??
              Array<number>(MUSCLE_WEEKS_BACK + 1).fill(0),
          ),
        },
      ];
    });
    const reached = (v: GoalView) =>
      v.kind === GoalKind.LIFT && v.progress.achieved;
    return [...views.filter((v) => !reached(v)), ...views.filter(reached)];
  }

  async create(dto: SaveGoalDto, userId: string): Promise<void> {
    const count = await this.goals.count({ where: { userId } });
    if (count >= MAX_GOALS) {
      throw new BadRequestException({ code: 'too_many_goals', max: MAX_GOALS });
    }
    const goal = this.goals.create({ userId, ...(await this.fields(dto)) });
    await this.goals.save(goal);
  }

  async update(id: string, dto: SaveGoalDto, userId: string): Promise<void> {
    const goal = await this.goals.findOneBy({ id, userId });
    if (!goal) throw new NotFoundException('Goal not found');
    Object.assign(goal, await this.fields(dto));
    // The loaded relation would otherwise win over the new id on save.
    goal.exerciseDefinition = undefined;
    await this.goals.save(goal);
  }

  async remove(id: string, userId: string) {
    const result = await this.goals.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Goal not found');
    return { deleted: true };
  }

  /** The stored columns for a goal; the other kind's fields are cleared. */
  private async fields(dto: SaveGoalDto): Promise<Partial<Goal>> {
    const shared = {
      kind: dto.kind,
      targetDate: dto.targetDate || null,
      note: dto.note?.trim() || null,
    };
    if (dto.kind === GoalKind.LIFT) {
      const def = await this.definitions.findOneBy({
        id: dto.exerciseDefinitionId!,
      });
      if (!def) throw new NotFoundException('Exercise not found');
      return {
        ...shared,
        exerciseDefinitionId: def.id,
        targetWeightKg: round1(dto.targetWeightKg ?? 0),
        targetReps: dto.targetReps,
        muscleGroup: null,
        targetSetsPerWeek: null,
      };
    }
    return {
      ...shared,
      exerciseDefinitionId: null,
      targetWeightKg: null,
      targetReps: null,
      muscleGroup: dto.muscleGroup,
      targetSetsPerWeek: dto.targetSetsPerWeek,
    };
  }

  /** Working sets of the given exercises, per definition id. */
  private async liftSets(userId: string, definitionIds: number[]) {
    const result = new Map<number, GoalSet[]>();
    if (!definitionIds.length) return result;
    const rows = await this.exercises.find({
      where: {
        exerciseDefinitionId: In([...new Set(definitionIds)]),
        workout: { userId },
      },
      relations: { workout: true, sets: true },
    });
    for (const e of rows) {
      const list = result.get(e.exerciseDefinitionId!) ?? [];
      for (const s of e.sets ?? []) {
        if (s.isWarmup) continue;
        list.push({
          reps: s.repsAmount,
          weightKg: Number(s.weightKg),
          date: String(e.workout.date).slice(0, 10),
        });
      }
      result.set(e.exerciseDefinitionId!, list);
    }
    return result;
  }

  /**
   * Working sets per muscle group, this week last. Counted like the coach
   * counts them: the muscle group stored on the logged exercise, warm-ups left
   * out, weeks starting on Monday.
   */
  private async muscleWeeks(userId: string, monday: string) {
    const window = await this.workouts.find({
      where: {
        userId,
        date: Between(
          addDays(monday, -7 * MUSCLE_WEEKS_BACK),
          addDays(monday, 6),
        ),
      },
      relations: { exercises: { sets: true } },
    });
    const entries = new Map<string, { date: string; sets: number }[]>();
    for (const w of window) {
      for (const e of w.exercises ?? []) {
        if (!e.muscleGroup) continue;
        const sets = (e.sets ?? []).filter((s) => !s.isWarmup).length;
        if (!sets) continue;
        const list = entries.get(e.muscleGroup) ?? [];
        list.push({ date: String(w.date).slice(0, 10), sets });
        entries.set(e.muscleGroup, list);
      }
    }
    return new Map(
      [...entries].map(([group, list]) => [
        group,
        weeklySets(list, monday, MUSCLE_WEEKS_BACK),
      ]),
    );
  }
}
