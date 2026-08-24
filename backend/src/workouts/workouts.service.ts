import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workout } from './workouts.entity';
import { DataSource, Repository } from 'typeorm';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { ExerciseSet } from '../sets/set.entity';

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectRepository(Workout) private workoutRepository: Repository<Workout>,
    private dataSource: DataSource,
  ) {}

  findAll(userId: string) {
    // Includes the exercise/set tree so list cards can show real exercise
    // counts and computed volume without an extra request per workout.
    return this.workoutRepository.find({
      where: { userId },
      relations: { exercises: { sets: true } },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Lightweight ownership check. Used as the authorization gate by nested
   * resources (exercises/sets), so it deliberately avoids loading relations.
   */
  async findOne(id: string, userId: string) {
    const workout = await this.workoutRepository.findOneBy({ id, userId });
    if (!workout) {
      throw new NotFoundException(`Workout with ID ${id} not found`);
    }
    return workout;
  }

  /**
   * Full workout tree (exercises ordered, each with ordered sets) for the
   * detail view — one request instead of three.
   */
  async findOneWithDetails(id: string, userId: string) {
    const workout = await this.workoutRepository.findOne({
      where: { id, userId },
      relations: { exercises: { sets: true } },
      order: {
        exercises: { orderInWorkout: 'ASC', sets: { setOrder: 'ASC' } },
      },
    });
    if (!workout) {
      throw new NotFoundException(`Workout with ID ${id} not found`);
    }
    return workout;
  }

  create(dto: CreateWorkoutDto, userId: string) {
    const workout = this.workoutRepository.create({ ...dto, userId });
    return this.workoutRepository.save(workout);
  }

  /**
   * "Re-run" a previous workout: deep-copies its exercises and sets into a new
   * workout dated today. Set numbers are copied so the user edits last time's
   * values rather than starting from scratch.
   */
  async duplicate(id: string, userId: string) {
    const source = await this.findOneWithDetails(id, userId);
    const today = new Date().toISOString().slice(0, 10);

    const newId = await this.dataSource.transaction(async (manager) => {
      const workout = manager.create(Workout, {
        date: today,
        name: source.name,
        description: source.description,
        userId,
      });
      const savedWorkout = await manager.save(workout);

      for (const exercise of source.exercises ?? []) {
        const newExercise = manager.create(WorkoutExercise, {
          workoutId: savedWorkout.id,
          exerciseDefinitionId: exercise.exerciseDefinitionId,
          name: exercise.name,
          type: exercise.type,
          muscleGroup: exercise.muscleGroup,
          orderInWorkout: exercise.orderInWorkout,
          notes: exercise.notes,
        });
        const savedExercise = await manager.save(newExercise);

        for (const set of exercise.sets ?? []) {
          const newSet = manager.create(ExerciseSet, {
            workoutExerciseId: savedExercise.id,
            setOrder: set.setOrder,
            repsAmount: set.repsAmount,
            weightKg: set.weightKg,
            notes: set.notes,
          });
          await manager.save(newSet);
        }
      }

      return savedWorkout.id;
    });

    return this.findOneWithDetails(newId, userId);
  }

  /**
   * Ownership check that also rejects edits to a finished workout. Used by the
   * nested exercise/set mutations so a completed workout is truly read-only.
   */
  async assertEditable(id: string, userId: string) {
    const workout = await this.findOne(id, userId);
    if (workout.completedAt) {
      throw new ConflictException('Workout is finished and cannot be edited');
    }
    return workout;
  }

  /**
   * Mark a workout as finished. Requires at least one exercise, and every
   * exercise must have at least one logged set — no empty exercises/workouts.
   */
  async finish(id: string, userId: string) {
    const workout = await this.findOneWithDetails(id, userId);
    if (!workout.exercises?.length) {
      throw new BadRequestException('Add at least one exercise before finishing');
    }
    const empty = workout.exercises.find((e) => !(e.sets?.length));
    if (empty) {
      throw new BadRequestException(
        `Log at least one set for "${empty.name}" before finishing`,
      );
    }
    await this.workoutRepository.update({ id, userId }, { completedAt: new Date() });
    return this.findOneWithDetails(id, userId);
  }

  async update(id: string, dto: UpdateWorkoutDto, userId: string) {
    const result = await this.workoutRepository.update({ id, userId }, dto);
    if (result.affected === 0) {
      throw new NotFoundException(`Workout with ID ${id} not found`);
    }
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const result = await this.workoutRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Workout with ID ${id} not found`);
    }
    return { deleted: true };
  }
}
