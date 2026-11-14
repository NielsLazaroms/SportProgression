import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as jwt from 'jsonwebtoken';

/** Requests per minute for anonymous callers (per IP address). */
export const ANONYMOUS_LIMIT = 30;
/** Requests per minute for a signed-in user (per account). */
export const SIGNED_IN_LIMIT = 300;

/**
 * Rate limiting that knows who is calling. Anonymous traffic keeps the strict
 * per-IP limit; a request carrying a valid access token is counted per user
 * with a higher ceiling, because logging a workout legitimately fires many
 * small requests. The token is verified here (not just "present"), so a made-up
 * cookie cannot buy the higher limit.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    req.throttleUserId = this.verifiedUserId(req);
    return super.canActivate(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.throttleUserId ? `user:${req.throttleUserId}` : `ip:${req.ip}`;
  }

  private verifiedUserId(req: Record<string, any>): string | null {
    const header: string | undefined = req.headers?.authorization;
    const token =
      req.cookies?.accessToken ??
      (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return null;
    try {
      const payload = jwt.verify(token, secret);
      return typeof payload === 'object' && payload.sub
        ? String(payload.sub)
        : null;
    } catch {
      return null;
    }
  }
}

/** Per-request limit used by the throttler configuration. */
export function limitFor(context: ExecutionContext): number {
  return context.switchToHttp().getRequest().throttleUserId
    ? SIGNED_IN_LIMIT
    : ANONYMOUS_LIMIT;
}
