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
import { postgresOptions } from './database/database-options';
import { ExercisesModule } from './exercises/exercises.module';
import { ExerciseDefinitionsModule } from './exercise-definitions/exercise-definitions.module';
import { SetsModule } from './sets/sets.module';
import { ProgressModule } from './progress/progress.module';
import { AccountModule } from './account/account.module';
import { TemplatesModule } from './templates/templates.module';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = (key: EnvKey) => config.get<string>(key);

        // The schema is managed by the migrations in
        // src/database/migrations, applied on startup (DB_MIGRATIONS_RUN=false
        // switches that off when they are run separately). Auto-sync is only
        // for throwaway databases: it can drop columns and their data, and
        // must never be mixed with migrations on the same database.
        const synchronize = env(EnvKey.DB_SYNCHRONIZE) === 'true';
        return {
          ...postgresOptions(env),
          autoLoadEntities: true,
          synchronize,
          migrationsRun:
            !synchronize && env(EnvKey.DB_MIGRATIONS_RUN) !== 'false',
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
    AnalysisModule,
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
