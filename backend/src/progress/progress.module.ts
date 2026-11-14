import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workout } from '../workouts/workouts.entity';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workout, WorkoutExercise])],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
