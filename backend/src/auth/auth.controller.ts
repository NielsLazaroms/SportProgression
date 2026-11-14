import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { DevSeedService } from './dev-seed.service';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {JwtService} from '@nestjs/jwt';
import { EnvKey } from '../../envKey';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly devSeed: DevSeedService,
  ) {}

  /**
   * Passwordless demo login for local development. Fails closed: it needs
   * DEV_LOGIN=true, NODE_ENV=development and the local SQLite database, so a
   * misconfigured production server can never expose it.
   */
  private devLoginEnabled(): boolean {
    return (
      this.config.get<string>(EnvKey.DEV_LOGIN) === 'true' &&
      this.config.get<string>(EnvKey.NODE_ENV) === 'development' &&
      this.config.get<string>(EnvKey.DB_TYPE) === 'sqljs'
    );
  }

  /** Lets the login page know which sign-in options this server offers. */
  @SkipThrottle()
  @Get('config')
  authConfig() {
    return { devLogin: this.devLoginEnabled() };
  }

  /**
   * `?as=<name>` signs in a separate throw-away account (for testing with
   * several users); `?seed=0` skips the sample training history.
   */
  @SkipThrottle()
  @Get('dev-login')
  async devLogin(
    @Res() res: Response,
    @Query('as') as?: string,
    @Query('seed') seed?: string,
  ) {
    if (!this.devLoginEnabled()) {
      throw new NotFoundException();
    }
    const slug = (as ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
    const { accessToken, refreshToken, user } = await this.auth.loginWithGoogle(
      slug
        ? {
            googleId: `dev-local-${slug}`,
            email: `${slug}@ironpulse.local`,
            firstName: 'Test',
            lastName: slug,
          }
        : {
            googleId: 'dev-local-user',
            email: 'demo@ironpulse.local',
            firstName: 'Demo',
            lastName: 'Athlete',
          },
    );
    if (seed !== '0') await this.devSeed.seedIfEmpty(user.id);

    const frontend = this.config.get<string>(
      EnvKey.FRONTEND_URL,
      'http://localhost:4200',
    );
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.redirect(`${frontend}/auth/callback`);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // redirect naar Google
  }

  // TODO remove any
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken, refreshToken } = await this.auth.loginWithGoogle(req.user);

    const frontend = this.config.get<string>(
      EnvKey.FRONTEND_URL,
      'http://localhost:4200',
    );
    const isProduction = this.config.get<string>(EnvKey.NODE_ENV) === 'production';

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return res.redirect(`${frontend}/auth/callback`);
  }

  @ApiBearerAuth()
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req: any) {
    return this.auth.getProfile(req.user.userId);
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new ForbiddenException('No refresh token provided');
    }

    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>(EnvKey.JWT_REFRESH_SECRET),
      });
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }

    const tokens = await this.auth.refreshTokens(payload.sub, refreshToken);
    const isProduction = this.config.get<string>(EnvKey.NODE_ENV) === 'production';

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({ message: 'Tokens refreshed' });
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req: any, @Res() res: Response) {
    await this.auth.logout(req.user.userId);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return res.json({ message: 'Logged out successfully' });
  }
}
