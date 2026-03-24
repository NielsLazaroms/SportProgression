import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutExercise } from './workout-exercise.entity';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { ExerciseDefinitionsModule } from '../exercise-definitions/exercise-definitions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkoutExercise]),
    ExerciseDefinitionsModule,
  ],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [TypeOrmModule],
})
export class ExercisesModule {}
