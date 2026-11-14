import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DEFAULT_EXERCISES } from './default-exercises';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { TemplateExercise } from '../templates/template.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseDefinition, ExerciseType } from './exercise-definition.entity';
import { CreateExerciseDefinitionDto } from './dto/create-exercise-definition.dto';
import { UpdateExerciseDefinitionDto } from './dto/update-exercise-definition.dto';

@Injectable()
export class ExerciseDefinitionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExerciseDefinitionsService.name);

  constructor(
    @InjectRepository(ExerciseDefinition)
    private exerciseDefinitionRepository: Repository<ExerciseDefinition>,
  ) {}

  /** Seed the starter catalog on a brand-new (empty) database. */
  async onApplicationBootstrap() {
    const typeOf = (bodyweight?: boolean) =>
      bodyweight ? ExerciseType.BODYWEIGHT : ExerciseType.STRENGTH;

    if ((await this.exerciseDefinitionRepository.count()) === 0) {
      await this.exerciseDefinitionRepository.save(
        DEFAULT_EXERCISES.map(({ bodyweight, ...e }) =>
          this.exerciseDefinitionRepository.create({
            ...e,
            type: typeOf(bodyweight),
          }),
        ),
      );
      this.logger.log(`Seeded ${DEFAULT_EXERCISES.length} default exercises`);
      return;
    }

    // Existing catalogs: make sure the standard bodyweight exercises exist and
    // are marked as such (they predate the bodyweight type). Only the shared,
    // ownerless defaults are touched — never an exercise a user created.
    for (const def of DEFAULT_EXERCISES.filter((d) => d.bodyweight)) {
      const existing = await this.findByName(def.name);
      if (!existing) {
        await this.exerciseDefinitionRepository.save(
          this.exerciseDefinitionRepository.create({
            name: def.name,
            muscleGroup: def.muscleGroup,
            type: ExerciseType.BODYWEIGHT,
          }),
        );
      } else if (
        !existing.createdByUserId &&
        existing.type !== ExerciseType.BODYWEIGHT
      ) {
        await this.exerciseDefinitionRepository.update(existing.id, {
          type: ExerciseType.BODYWEIGHT,
        });
        await this.propagateSnapshot(existing.id, {
          type: ExerciseType.BODYWEIGHT,
        });
      }
    }
  }

  /**
   * Logged workouts and templates keep a copy of an exercise's name, muscle
   * group and type; carry a change through so history, plans and progress
   * show it too.
   */
  private async propagateSnapshot(
    id: number,
    snapshot: { name?: string; muscleGroup?: string; type?: ExerciseType },
  ) {
    if (!Object.keys(snapshot).length) return;
    const manager = this.exerciseDefinitionRepository.manager;
    await manager.update(WorkoutExercise, { exerciseDefinitionId: id }, snapshot);
    await manager.update(TemplateExercise, { exerciseDefinitionId: id }, snapshot);
  }

  findAll() {
    return this.exerciseDefinitionRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number) {
    const definition = await this.exerciseDefinitionRepository.findOneBy({
      id,
    });
    if (!definition) {
      throw new NotFoundException(
        `Exercise definition with ID ${id} not found`,
      );
    }
    return definition;
  }

  /** Case-insensitive lookup, so "bench press" finds "Bench Press". */
  private findByName(name: string) {
    return this.exerciseDefinitionRepository
      .createQueryBuilder('d')
      .where('LOWER(d.name) = LOWER(:name)', { name: name.trim() })
      .getOne();
  }

  /**
   * Adds an exercise to the shared catalog. A name that already exists
   * (ignoring case) returns that entry instead of creating a twin, because two
   * "Bench Press" entries would split a lifter's history and progress in two.
   */
  async create(dto: CreateExerciseDefinitionDto, userId: string) {
    const existing = await this.findByName(dto.name);
    if (existing) return existing;
    const definition = this.exerciseDefinitionRepository.create({
      ...dto,
      type: dto.type ?? ExerciseType.STRENGTH,
      createdByUserId: userId,
    });
    return this.exerciseDefinitionRepository.save(definition);
  }

  async update(id: number, dto: UpdateExerciseDefinitionDto, userId: string) {
    await this.assertOwnedByUser(id, userId);
    if (dto.name) {
      const twin = await this.findByName(dto.name);
      if (twin && twin.id !== id) {
        throw new ConflictException(
          `An exercise named "${twin.name}" already exists`,
        );
      }
    }
    await this.exerciseDefinitionRepository.update(id, dto);
    await this.propagateSnapshot(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.muscleGroup ? { muscleGroup: dto.muscleGroup } : {}),
      ...(dto.type ? { type: dto.type } : {}),
    });
    return this.findOne(id);
  }

  async remove(id: number, userId: string) {
    await this.assertOwnedByUser(id, userId);
    // The catalog is shared: deleting an exercise that has been logged would
    // detach it from everyone's history and progress charts.
    const inUse = await this.exerciseDefinitionRepository.manager.count(
      WorkoutExercise,
      { where: { exerciseDefinitionId: id } },
    );
    if (inUse > 0) {
      throw new ConflictException(
        'This exercise has logged workouts and cannot be deleted',
      );
    }
    await this.exerciseDefinitionRepository.delete(id);
    return { deleted: true };
  }

  /**
   * Definitions are a shared, read-only catalog for everyone, but only the
   * user who created a definition may modify or delete it.
   */
  private async assertOwnedByUser(id: number, userId: string) {
    const definition = await this.findOne(id);
    if (definition.createdByUserId !== userId) {
      throw new ForbiddenException(
        `You do not have permission to modify exercise definition ${id}`,
      );
    }
    return definition;
  }
}
