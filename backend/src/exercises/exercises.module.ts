import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutExercise } from './workout-exercise.entity';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { ExerciseDefinitionsModule } from '../exercise-definitions/exercise-definitions.module';
import { WorkoutsModule } from '../workouts/workouts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkoutExercise]),
    ExerciseDefinitionsModule,
    WorkoutsModule,
  ],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [TypeOrmModule, ExercisesService],
})
export class ExercisesModule {}
