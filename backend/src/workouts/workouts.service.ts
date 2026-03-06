import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workout } from './workouts.entity';
import { Repository } from 'typeorm';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(
    @InjectRepository(Workout) private workoutRepository: Repository<Workout>,
  ) {}
  findAll(userId: string) {
    return this.workoutRepository.find({
      where: { userId },
      order: { date: 'DESC' },
    });
  }
  async findOne(id: string, userId: string) {
    const workout = await this.workoutRepository.findOneBy({ id, userId });
    if (!workout) {
      throw new NotFoundException(`Workout with ID ${id} not found`);
    }
    return workout;
  }
  create(dto: CreateWorkoutDto, userId: string) {
    const workout = this.workoutRepository.create({ ...dto, userId });
    return this.workoutRepository.save(workout);
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
