import { Module } from '@nestjs/common';
import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workout } from './workouts.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Workout])],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
})
export class WorkoutsModule {}
