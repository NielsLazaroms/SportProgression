import * as crypto from 'crypto';
import type { Request } from 'express';

const COOKIE = 'oauthState';

/**
 * Anti-forgery "state" for the Google sign-in round trip, without server
 * sessions: a random value is stored in a short-lived httpOnly cookie when the
 * user is sent to Google and must come back unchanged in the callback. That
 * stops an attacker from completing *their* sign-in in the victim's browser.
 *
 * `path` is where the browser sees the sign-in routes: behind the frontend
 * nginx that is /api/auth/google (nginx strips /api before the API sees it),
 * so the cookie must be scoped to the public path, not the API's own route.
 */
export class CookieStateStore {
  constructor(
    private readonly secure: boolean,
    private readonly path: string,
  ) {}

  store(req: Request, callback: (err: Error | null, state?: string) => void) {
    const state = crypto.randomBytes(24).toString('hex');
    req.res?.cookie(COOKIE, state, {
      httpOnly: true,
      secure: this.secure,
      // "lax" so the cookie is sent on the top-level redirect back from Google.
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: this.path,
    });
    callback(null, state);
  }

  verify(
    req: Request,
    providedState: string,
    callback: (err: Error | null, ok?: boolean, info?: unknown) => void,
  ) {
    const expected: unknown = req.cookies?.[COOKIE];
    req.res?.clearCookie(COOKIE, { path: this.path });
    const ok =
      typeof expected === 'string' &&
      typeof providedState === 'string' &&
      expected.length === providedState.length &&
      crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(providedState),
      );
    if (!ok) {
      return callback(null, false, { message: 'Invalid sign-in state' });
    }
    callback(null, true);
  }
}
