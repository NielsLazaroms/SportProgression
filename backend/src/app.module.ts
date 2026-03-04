import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const sslEnabled = (config.get<string>('DB_SSL') ?? 'false') === 'true';

        return {
          type: 'mysql',
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT', 3306),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASS'),
          database: config.get<string>('DB_NAME'),

          // Handig voor debugging:
          logging: true,

          // Voor nu ok:
          autoLoadEntities: true,
          synchronize: false, // voor "werkt verbinding?" hoeft dit niet

          // SSL (alleen als nodig):
          ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
        };
      },
    }),
    HealthModule,
    WorkoutsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
