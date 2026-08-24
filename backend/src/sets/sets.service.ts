import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseSet } from './set.entity';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { ExercisesService } from '../exercises/exercises.service';

@Injectable()
export class SetsService {
  constructor(
    @InjectRepository(ExerciseSet)
    private setRepository: Repository<ExerciseSet>,
    private exercisesService: ExercisesService,
  ) {}

  async findAll(workoutExerciseId: number, userId: string) {
    await this.exercisesService.verifyOwnership(workoutExerciseId, userId);
    return this.setRepository.find({
      where: { workoutExerciseId },
      order: { setOrder: 'ASC' },
    });
  }

  async findOne(setId: number, workoutExerciseId: number, userId: string) {
    await this.exercisesService.verifyOwnership(workoutExerciseId, userId);
    const set = await this.setRepository.findOneBy({
      setId,
      workoutExerciseId,
    });
    if (!set) {
      throw new NotFoundException(`Set with ID ${setId} not found`);
    }
    return set;
  }

  async create(dto: CreateSetDto, workoutExerciseId: number, userId: string) {
    await this.exercisesService.verifyOwnership(workoutExerciseId, userId, true);
    const set = this.setRepository.create({ ...dto, workoutExerciseId });
    return this.setRepository.save(set);
  }

  async update(
    setId: number,
    dto: UpdateSetDto,
    workoutExerciseId: number,
    userId: string,
  ) {
    await this.exercisesService.verifyOwnership(workoutExerciseId, userId, true);
    const result = await this.setRepository.update(
      { setId, workoutExerciseId },
      dto,
    );
    if (result.affected === 0) {
      throw new NotFoundException(`Set with ID ${setId} not found`);
    }
    return this.findOne(setId, workoutExerciseId, userId);
  }

  async remove(setId: number, workoutExerciseId: number, userId: string) {
    await this.exercisesService.verifyOwnership(workoutExerciseId, userId, true);
    const result = await this.setRepository.delete({
      setId,
      workoutExerciseId,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`Set with ID ${setId} not found`);
    }
    return { deleted: true };
  }
}
