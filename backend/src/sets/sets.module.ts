import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseSet } from './set.entity';
import { SetsController } from './sets.controller';
import { SetsService } from './sets.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseSet])],
  controllers: [SetsController],
  providers: [SetsService],
  exports: [TypeOrmModule],
})
export class SetsModule {}
