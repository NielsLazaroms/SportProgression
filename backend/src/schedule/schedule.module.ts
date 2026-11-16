import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduledWorkout } from './scheduled-workout.entity';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { ExerciseDefinition } from '../exercise-definitions/exercise-definition.entity';
import { WorkoutsModule } from '../workouts/workouts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledWorkout, ExerciseDefinition]),
    WorkoutsModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class WorkoutScheduleModule {}
