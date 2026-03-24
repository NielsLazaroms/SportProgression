import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseDefinition } from './exercise-definition.entity';
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

  create(dto: CreateExerciseDefinitionDto) {
    const definition = this.exerciseDefinitionRepository.create(dto);
    return this.exerciseDefinitionRepository.save(definition);
  }

  async update(id: number, dto: UpdateExerciseDefinitionDto) {
    const result = await this.exerciseDefinitionRepository.update(id, dto);
    if (result.affected === 0) {
      throw new NotFoundException(
        `Exercise definition with ID ${id} not found`,
      );
    }
    return this.findOne(id);
  }

  async remove(id: number) {
    const result = await this.exerciseDefinitionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(
        `Exercise definition with ID ${id} not found`,
      );
    }
    return { deleted: true };
  }
}
