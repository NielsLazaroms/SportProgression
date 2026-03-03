import { Module } from '@nestjs/common';
import { WorkoutsController } from './workouts.controller';

@Module({
  controllers: [WorkoutsController]
})
export class WorkoutsModule {}
