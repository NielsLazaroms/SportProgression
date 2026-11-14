import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateExercise, WorkoutTemplate } from './template.entity';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { WorkoutsModule } from '../workouts/workouts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkoutTemplate, TemplateExercise]),
    WorkoutsModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule {}
