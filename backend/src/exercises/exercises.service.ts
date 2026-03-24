import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkoutExercise } from './workout-exercise.entity';
import { ExerciseDefinitionsService } from '../exercise-definitions/exercise-definitions.service';
import { CreateWorkoutExerciseDto } from './dto/create-exercise.dto';
import { UpdateWorkoutExerciseDto } from './dto/update-exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(WorkoutExercise)
    private workoutExerciseRepository: Repository<WorkoutExercise>,
    private exerciseDefinitionsService: ExerciseDefinitionsService,
  ) {}

  findAll(workoutId: string) {
    return this.workoutExerciseRepository.find({
      where: { workoutId },
      order: { orderInWorkout: 'ASC' },
      relations: ['sets'],
    });
  }

  async findOne(id: number, workoutId: string) {
    const exercise = await this.workoutExerciseRepository.findOne({
      where: { id, workoutId },
      relations: ['sets'],
    });
    if (!exercise) {
      throw new NotFoundException(`Workout exercise with ID ${id} not found`);
    }
    return exercise;
  }

  async create(dto: CreateWorkoutExerciseDto, workoutId: string) {
    const definition = await this.exerciseDefinitionsService.findOne(
      dto.exerciseDefinitionId,
    );

    const exercise = this.workoutExerciseRepository.create({
      workoutId,
      exerciseDefinitionId: definition.id,
      name: definition.name,
      type: definition.type,
      muscleGroup: definition.muscleGroup,
      orderInWorkout: dto.orderInWorkout,
      notes: dto.notes,
    });

    const saved = await this.workoutExerciseRepository.save(exercise);
    return this.findOne(saved.id, workoutId);
  }

  async update(id: number, dto: UpdateWorkoutExerciseDto, workoutId: string) {
    const result = await this.workoutExerciseRepository.update(
      { id, workoutId },
      dto,
    );
    if (result.affected === 0) {
      throw new NotFoundException(`Workout exercise with ID ${id} not found`);
    }
    return this.findOne(id, workoutId);
  }

  async remove(id: number, workoutId: string) {
    const result = await this.workoutExerciseRepository.delete({
      id,
      workoutId,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`Workout exercise with ID ${id} not found`);
    }
    return { deleted: true };
  }
}
