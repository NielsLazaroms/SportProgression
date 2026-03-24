import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseDefinition } from './exercise-definition.entity';
import { ExerciseDefinitionsController } from './exercise-definitions.controller';
import { ExerciseDefinitionsService } from './exercise-definitions.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseDefinition])],
  controllers: [ExerciseDefinitionsController],
  providers: [ExerciseDefinitionsService],
  exports: [TypeOrmModule, ExerciseDefinitionsService],
})
export class ExerciseDefinitionsModule {}
