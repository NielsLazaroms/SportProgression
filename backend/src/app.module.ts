import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard, limitFor } from './auth/user-throttler.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { EnvKey } from '../envKey';
import { ExercisesModule } from './exercises/exercises.module';
import { ExerciseDefinitionsModule } from './exercise-definitions/exercise-definitions.module';
import { SetsModule } from './sets/sets.module';
import { ProgressModule } from './progress/progress.module';
import { AccountModule } from './account/account.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const sslEnabled =
          (config.get<string>(EnvKey.DB_SSL) ?? 'false') === 'true';

        // Schema auto-sync rewrites tables to match the code. Handy while
        // developing, dangerous on real data (a renamed column is dropped and
        // re-created empty), so in production it is OFF unless explicitly
        // requested with DB_SYNCHRONIZE=true.
        const syncSetting = config.get<string>(EnvKey.DB_SYNCHRONIZE);
        const synchronize =
          syncSetting !== undefined && syncSetting !== ''
            ? syncSetting === 'true'
            : config.get<string>(EnvKey.NODE_ENV) !== 'production';
        // SQL logging prints user data (notes, e-mail addresses) to the logs.
        const logging = config.get<string>(EnvKey.DB_LOGGING) === 'true';

        // Zero-setup local development: DB_TYPE=sqljs stores everything in a
        // single SQLite file (pure JS, no database server needed).
        if (config.get<string>(EnvKey.DB_TYPE) === 'sqljs') {
          return {
            type: 'sqljs',
            location: config.get<string>(EnvKey.DB_FILE, 'dev-data.sqlite'),
            autoSave: true,
            autoLoadEntities: true,
            synchronize,
          };
        }

        return {
          type: 'mysql',
          host: config.get<string>(EnvKey.DB_HOST),
          port: config.get<number>(EnvKey.DB_PORT, 3306),
          username: config.get<string>(EnvKey.DB_USER),
          password: config.get<string>(EnvKey.DB_PASS),
          database: config.get<string>(EnvKey.DB_NAME),

          logging,
          autoLoadEntities: true,
          synchronize,
          ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
        };
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        // 30/min for anonymous callers, 300/min once signed in.
        limit: limitFor,
      },
    ]),
    HealthModule,
    WorkoutsModule,
    ExercisesModule,
    ExerciseDefinitionsModule,
    SetsModule,
    ProgressModule,
    AccountModule,
    TemplatesModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}
