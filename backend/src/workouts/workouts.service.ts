import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Workout} from './workouts.entity';
import {Repository} from 'typeorm';

@Injectable()
export class WorkoutsService {
  constructor(@InjectRepository(Workout) private workoutRepository: Repository<Workout>) {}
  findAll() {
    return this.workoutRepository.find({order: {date: 'DESC'}});
   }
}
