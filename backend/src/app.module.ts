import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { WorkoutsModule } from './workouts/workouts.module';

@Module({
  imports: [HealthModule, WorkoutsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
