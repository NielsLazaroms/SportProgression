import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EnvKey } from '../../envKey';
import { RefreshToken } from './refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async loginWithGoogle(profile: {
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
  }) {
    const user = await this.users.findOrCreateFromGoogle(profile);

    const family = crypto.randomUUID();
    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken, family);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        picture: user.picture,
      },
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // Find the matching token record
    const storedTokens = await this.refreshTokenRepo.find({
      where: { userId, isRevoked: false },
    });

    let matchedToken: RefreshToken | null = null;
    for (const stored of storedTokens) {
      const matches = await bcrypt.compare(refreshToken, stored.hashedToken);
      if (matches) {
        matchedToken = stored;
        break;
      }
    }

    if (!matchedToken) {
      // Token not found among active tokens — check if it matches a revoked token (reuse detection)
      const revokedTokens = await this.refreshTokenRepo.find({
        where: { userId, isRevoked: true },
      });

      for (const revoked of revokedTokens) {
        const matches = await bcrypt.compare(refreshToken, revoked.hashedToken);
        if (matches) {
          // Reuse detected! Invalidate the entire family
          await this.revokeFamily(revoked.family);
          throw new ForbiddenException('Refresh token reuse detected — all sessions in this family have been revoked');
        }
      }

      throw new ForbiddenException('Access denied');
    }

    // Check expiration
    if (matchedToken.expiresAt < new Date()) {
      await this.revokeFamily(matchedToken.family);
      throw new ForbiddenException('Refresh token expired');
    }

    // Revoke the used token (rotation)
    matchedToken.isRevoked = true;
    await this.refreshTokenRepo.save(matchedToken);

    // Issue new tokens in the same family
    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken, matchedToken.family);

    return tokens;
  }

  async logout(userId: string) {
    // Revoke all refresh tokens for this user
    await this.refreshTokenRepo.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
  }

  private async storeRefreshToken(userId: string, refreshToken: string, family: string) {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const token = this.refreshTokenRepo.create({
      hashedToken,
      family,
      userId,
      expiresAt,
    });

    await this.refreshTokenRepo.save(token);
  }

  private async revokeFamily(family: string) {
    await this.refreshTokenRepo.update(
      { family, isRevoked: false },
      { isRevoked: true },
    );
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>(EnvKey.JWT_SECRET),
      expiresIn: this.config.get<string>(EnvKey.JWT_EXPIRES_IN, '15m'),
    } as any);

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>(EnvKey.JWT_REFRESH_SECRET),
      expiresIn: this.config.get<string>(EnvKey.JWT_REFRESH_EXPIRES_IN, '7d'),
    } as any);

    return {
      accessToken,
      refreshToken,
    };
  }
}
