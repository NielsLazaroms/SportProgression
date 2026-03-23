import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exercise, ExerciseType } from './exercise.entity';
import { StrengthExercise } from './strength-exercise.entity';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(Exercise)
    private exerciseRepository: Repository<Exercise>,
    @InjectRepository(StrengthExercise)
    private strengthExerciseRepository: Repository<StrengthExercise>,
  ) {}

  findAll(workoutId: string) {
    return this.exerciseRepository.find({
      where: { workoutId },
      order: { orderInWorkout: 'ASC' },
      relations: ['strengthExercise'],
    });
  }

  async findOne(exerciseId: number, workoutId: string) {
    const exercise = await this.exerciseRepository.findOne({
      where: { exerciseId, workoutId },
      relations: ['strengthExercise'],
    });
    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }
    return exercise;
  }

  async create(dto: CreateExerciseDto, workoutId: string) {
    const { muscleGroup, ...exerciseData } = dto;
    const exercise = this.exerciseRepository.create({
      ...exerciseData,
      workoutId,
    });
    const saved = await this.exerciseRepository.save(exercise);

    if (dto.type === ExerciseType.STRENGTH && muscleGroup) {
      const strength = this.strengthExerciseRepository.create({
        exerciseId: saved.exerciseId,
        muscleGroup,
      });
      await this.strengthExerciseRepository.save(strength);
    }

    return this.findOne(saved.exerciseId, workoutId);
  }

  async update(exerciseId: number, dto: UpdateExerciseDto, workoutId: string) {
    const { muscleGroup, ...exerciseData } = dto;

    const result = await this.exerciseRepository.update(
      { exerciseId, workoutId },
      exerciseData,
    );
    if (result.affected === 0) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    if (muscleGroup !== undefined) {
      await this.strengthExerciseRepository.update(
        { exerciseId },
        { muscleGroup },
      );
    }

    return this.findOne(exerciseId, workoutId);
  }

  async remove(exerciseId: number, workoutId: string) {
    const result = await this.exerciseRepository.delete({
      exerciseId,
      workoutId,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }
    return { deleted: true };
  }
}
