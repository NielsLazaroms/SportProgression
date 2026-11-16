import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from './goal.entity';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { ExerciseDefinition } from '../exercise-definitions/exercise-definition.entity';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { Workout } from '../workouts/workouts.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Goal,
      ExerciseDefinition,
      WorkoutExercise,
      Workout,
    ]),
  ],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
