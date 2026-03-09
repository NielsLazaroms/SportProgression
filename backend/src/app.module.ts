import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EnvKey } from '../envKey';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const sslEnabled =
          (config.get<string>(EnvKey.DB_SSL) ?? 'false') === 'true';

        return {
          type: 'mysql',
          host: config.get<string>(EnvKey.DB_HOST),
          port: config.get<number>(EnvKey.DB_PORT, 3306),
          username: config.get<string>(EnvKey.DB_USER),
          password: config.get<string>(EnvKey.DB_PASS),
          database: config.get<string>(EnvKey.DB_NAME),

          logging: true,
          // TODO look into this if it is needed
          autoLoadEntities: true,
          synchronize: true,
          ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
        };
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),
    HealthModule,
    WorkoutsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
