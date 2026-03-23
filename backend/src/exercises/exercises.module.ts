import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from './exercise.entity';
import { StrengthExercise } from './strength-exercise.entity';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise, StrengthExercise])],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [TypeOrmModule],
})
export class ExercisesModule {}
