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
  findAll() {
    return this.workoutRepository.find({ order: { date: 'DESC' } });
  }
  async findOne(id: number) {
    const workout = await this.workoutRepository.findOneBy({ id });
    if (!workout) {
      throw new NotFoundException(`Workout with ID ${id} not found`);
    }
    return workout;
  }
  create(dto: CreateWorkoutDto) {
    const workout = this.workoutRepository.create(dto);
    return this.workoutRepository.save(workout);
  }
  async update(id: number, dto: UpdateWorkoutDto) {
    const result = await this.workoutRepository.update(id, dto);
    if (result.affected === 0) {
      throw new NotFoundException(`Workout with ID ${id} not found`);
    }
    return this.findOne(id);
  }
  async remove(id: number) {
    const result = await this.workoutRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Workout with ID ${id} not found`);
    }
    return { deleted: true };
  }
}
