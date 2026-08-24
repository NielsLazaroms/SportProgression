import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseDefinition, ExerciseType } from './exercise-definition.entity';
import { CreateExerciseDefinitionDto } from './dto/create-exercise-definition.dto';
import { UpdateExerciseDefinitionDto } from './dto/update-exercise-definition.dto';

@Injectable()
export class ExerciseDefinitionsService {
  constructor(
    @InjectRepository(ExerciseDefinition)
    private exerciseDefinitionRepository: Repository<ExerciseDefinition>,
  ) {}

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

  create(dto: CreateExerciseDefinitionDto, userId: string) {
    const definition = this.exerciseDefinitionRepository.create({
      ...dto,
      type: dto.type ?? ExerciseType.STRENGTH,
      createdByUserId: userId,
    });
    return this.exerciseDefinitionRepository.save(definition);
  }

  async update(id: number, dto: UpdateExerciseDefinitionDto, userId: string) {
    await this.assertOwnedByUser(id, userId);
    await this.exerciseDefinitionRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number, userId: string) {
    await this.assertOwnedByUser(id, userId);
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
