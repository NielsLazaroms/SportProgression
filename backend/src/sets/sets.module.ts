import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseSet } from './set.entity';
import { SetsController } from './sets.controller';
import { SetsService } from './sets.service';
import { ExercisesModule } from '../exercises/exercises.module';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseSet]), ExercisesModule],
  controllers: [SetsController],
  providers: [SetsService],
  exports: [TypeOrmModule],
})
export class SetsModule {}
