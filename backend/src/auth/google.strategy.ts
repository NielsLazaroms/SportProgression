import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import {
  Strategy,
  StrategyOptions,
  VerifyCallback,
} from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { CookieStateStore } from './oauth-state.store';

function devFallback(config: ConfigService): string {
  return config.get<string>('NODE_ENV') === 'development'
    ? 'not-configured'
    : (undefined as unknown as string);
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      // In local development the app may boot without Google credentials
      // (Google sign-in then simply won't work). Anywhere else a missing
      // value still fails fast at startup.
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || devFallback(config),
      clientSecret:
        config.get<string>('GOOGLE_CLIENT_SECRET') || devFallback(config),
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
      // The typings only know the session-based store; ours is cookie-based.
      store: new CookieStateStore(
        config.get<string>('NODE_ENV') === 'production',
      ) as unknown as StrategyOptions['store'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const firstName = profile.name?.givenName;
    const lastName = profile.name?.familyName;
    const picture = profile.photos?.[0]?.value;

    done(null, { googleId, email, firstName, lastName, picture });
  }
}
