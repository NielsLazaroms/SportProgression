import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { TemplateExercise, WorkoutTemplate } from './template.entity';
import {
  SaveTemplateDto,
  StartTemplateDto,
  TemplateExerciseDto,
} from './dto/template.dto';
import { ExerciseDefinition } from '../exercise-definitions/exercise-definition.entity';
import { Workout } from '../workouts/workouts.entity';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { WorkoutsService } from '../workouts/workouts.service';
import { normalizeSupersets } from '../common/superset';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(WorkoutTemplate)
    private templates: Repository<WorkoutTemplate>,
    private dataSource: DataSource,
    private workouts: WorkoutsService,
  ) {}

  findAll(userId: string) {
    return this.templates.find({
      where: { userId },
      relations: { exercises: true },
      order: { name: 'ASC', exercises: { orderInTemplate: 'ASC' } },
    });
  }

  async findOne(id: string, userId: string) {
    const template = await this.templates.findOne({
      where: { id, userId },
      relations: { exercises: true },
      order: { exercises: { orderInTemplate: 'ASC' } },
    });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  /** Turns the requested exercises into rows, snapshotting the catalog entry. */
  private async buildExercises(items: TemplateExerciseDto[]) {
    const ids = [...new Set(items.map((i) => i.exerciseDefinitionId))];
    const definitions = ids.length
      ? await this.dataSource
          .getRepository(ExerciseDefinition)
          .findBy({ id: In(ids) })
      : [];
    const byId = new Map(definitions.map((d) => [d.id, d]));
    const groups = normalizeSupersets(items.map((i) => i.supersetGroup));
    return items.map((item, index) => {
      const def = byId.get(item.exerciseDefinitionId);
      if (!def) {
        throw new NotFoundException(
          `Exercise definition with ID ${item.exerciseDefinitionId} not found`,
        );
      }
      return {
        exerciseDefinitionId: def.id,
        name: def.name,
        type: def.type,
        muscleGroup: def.muscleGroup,
        orderInTemplate: index + 1,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        supersetGroup: groups[index],
      };
    });
  }

  async create(dto: SaveTemplateDto, userId: string) {
    const exercises = await this.buildExercises(dto.exercises);
    const saved = await this.templates.save(
      this.templates.create({ name: dto.name, userId, exercises }),
    );
    return this.findOne(saved.id, userId);
  }

  /** Replaces name and the whole exercise list. */
  async update(id: string, dto: SaveTemplateDto, userId: string) {
    await this.findOne(id, userId);
    const exercises = await this.buildExercises(dto.exercises);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(WorkoutTemplate, { id, userId }, { name: dto.name });
      await manager.delete(TemplateExercise, { templateId: id });
      await manager.save(
        exercises.map((e) =>
          manager.create(TemplateExercise, { ...e, templateId: id }),
        ),
      );
    });
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const result = await this.templates.delete({ id, userId });
    if (!result.affected) throw new NotFoundException(`Template ${id} not found`);
    return { deleted: true };
  }

  /**
   * "Save as template": the plan becomes what was actually done — per
   * exercise the number of working sets, at the reps used most often.
   * Exercises without working sets, or whose catalog entry is gone, are left
   * out; an exercise logged twice in the workout is planned once.
   */
  async createFromWorkout(workoutId: string, userId: string, name?: string) {
    const workout = await this.workouts.findOneWithDetails(workoutId, userId);
    const seen = new Set<number>();
    const exercises: TemplateExerciseDto[] = [];
    for (const ex of workout.exercises ?? []) {
      const working = (ex.sets ?? []).filter((s) => !s.isWarmup);
      const defId = ex.exerciseDefinitionId;
      if (defId == null || !working.length || seen.has(defId)) continue;
      seen.add(defId);
      const counts = new Map<number, number>();
      for (const s of working) {
        counts.set(s.repsAmount, (counts.get(s.repsAmount) ?? 0) + 1);
      }
      // Most common rep count; ties go to the higher one.
      const targetReps = [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || b[0] - a[0],
      )[0][0];
      exercises.push({
        exerciseDefinitionId: defId,
        targetSets: Math.min(working.length, 20),
        targetReps,
        supersetGroup: ex.supersetGroup,
      });
    }
    return this.create({ name: name ?? workout.name, exercises }, userId);
  }

  /** Starts a workout from the plan: its exercises, each with its target. */
  async start(id: string, dto: StartTemplateDto, userId: string) {
    const template = await this.findOne(id, userId);
    const workoutId = await this.dataSource.transaction(async (manager) => {
      const workout = await manager.save(
        manager.create(Workout, {
          userId,
          name: dto.name || template.name,
          date: dto.date ?? new Date().toISOString().slice(0, 10),
          description: dto.description || undefined,
          templateId: template.id,
        }),
      );
      let order = 1;
      for (const ex of template.exercises) {
        await manager.save(
          manager.create(WorkoutExercise, {
            workoutId: workout.id,
            exerciseDefinitionId: ex.exerciseDefinitionId,
            name: ex.name,
            type: ex.type,
            muscleGroup: ex.muscleGroup,
            orderInWorkout: order++,
            targetSets: ex.targetSets,
            targetReps: ex.targetReps,
            supersetGroup: ex.supersetGroup,
          }),
        );
      }
      return workout.id;
    });
    return this.workouts.findOneWithDetails(workoutId, userId);
  }
}
