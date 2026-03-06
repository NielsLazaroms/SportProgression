import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { RefreshToken } from './refresh-token.entity';
import { TokenCleanupService } from './token-cleanup.service';
import { EnvKey } from '../../envKey';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      // TODO remove as any
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(EnvKey.JWT_SECRET),
        signOptions: {
          expiresIn: config.get<string>(EnvKey.JWT_EXPIRES_IN, '15m'),
        } as any,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, JwtStrategy, TokenCleanupService],
})
export class AuthModule {}
