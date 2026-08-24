import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkoutExercise } from './workout-exercise.entity';
import { ExerciseDefinitionsService } from '../exercise-definitions/exercise-definitions.service';
import { CreateWorkoutExerciseDto } from './dto/create-exercise.dto';
import { UpdateWorkoutExerciseDto } from './dto/update-exercise.dto';
import { WorkoutsService } from '../workouts/workouts.service';

@Injectable()
export class ExercisesService {
  constructor(
    @InjectRepository(WorkoutExercise)
    private workoutExerciseRepository: Repository<WorkoutExercise>,
    private exerciseDefinitionsService: ExerciseDefinitionsService,
    private workoutsService: WorkoutsService,
  ) {}

  async findAll(workoutId: string, userId: string) {
    await this.workoutsService.findOne(workoutId, userId);
    return this.workoutExerciseRepository.find({
      where: { workoutId },
      order: { orderInWorkout: 'ASC' },
      relations: ['sets'],
    });
  }

  async findOne(id: number, workoutId: string, userId: string) {
    await this.workoutsService.findOne(workoutId, userId);
    const exercise = await this.workoutExerciseRepository.findOne({
      where: { id, workoutId },
      relations: ['sets'],
    });
    if (!exercise) {
      throw new NotFoundException(`Workout exercise with ID ${id} not found`);
    }
    return exercise;
  }

  /**
   * Asserts that the given exercise exists and belongs to a workout owned by
   * the user. Used by nested resources (e.g. sets) to enforce ownership when
   * the workout id is not part of the route.
   */
  async verifyOwnership(id: number, userId: string, requireEditable = false) {
    const exercise = await this.workoutExerciseRepository.findOne({
      where: { id, workout: { userId } },
      relations: ['workout'],
    });
    if (!exercise) {
      throw new NotFoundException(`Workout exercise with ID ${id} not found`);
    }
    if (requireEditable && exercise.workout?.completedAt) {
      throw new ConflictException('Workout is finished and cannot be edited');
    }
    return exercise;
  }

  async create(dto: CreateWorkoutExerciseDto, workoutId: string, userId: string) {
    await this.workoutsService.assertEditable(workoutId, userId);
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
    return this.findOne(saved.id, workoutId, userId);
  }

  async update(
    id: number,
    dto: UpdateWorkoutExerciseDto,
    workoutId: string,
    userId: string,
  ) {
    await this.workoutsService.assertEditable(workoutId, userId);
    const result = await this.workoutExerciseRepository.update(
      { id, workoutId },
      dto,
    );
    if (result.affected === 0) {
      throw new NotFoundException(`Workout exercise with ID ${id} not found`);
    }
    return this.findOne(id, workoutId, userId);
  }

  async remove(id: number, workoutId: string, userId: string) {
    await this.workoutsService.assertEditable(workoutId, userId);
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
