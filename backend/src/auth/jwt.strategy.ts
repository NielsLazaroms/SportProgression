import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { EnvKey } from '../../envKey';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.accessToken ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: config.get<string>(EnvKey.JWT_SECRET)!,
    });
  }

  /**
   * A valid signature is not enough: the account must still exist and the
   * token must belong to its current token version. That is what makes
   * sign-out (and account deletion) take effect immediately.
   */
  async validate(payload: { sub: string; email: string; tv?: number }) {
    const user = await this.users.findById(payload.sub);
    if (!user || (payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, email: payload.email };
  }
}
