import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutExercise } from '../exercises/workout-exercise.entity';
import { ExerciseDefinition } from '../exercise-definitions/exercise-definition.entity';
import { User } from '../users/user.entity';
import { Workout } from '../workouts/workouts.entity';
import { AiAccessGuard } from './ai-access.guard';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { GoalsModule } from '../goals/goals.module';
import { ScheduledWorkout } from '../schedule/scheduled-workout.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workout, WorkoutExercise, User, ExerciseDefinition, ScheduledWorkout]),
    GoalsModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, AiAccessGuard],
})
export class AnalysisModule {}
