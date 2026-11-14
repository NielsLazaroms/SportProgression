import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './data-access/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Must be resolved here: inject() only works synchronously inside the
  // interceptor call, not later inside an RxJS callback.
  const authService = inject(AuthService);

  // Add withCredentials to all requests so cookies are sent
  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error) => {
      // Auth endpoints handle their own failures (and must not loop).
      if (error.status !== 401 || req.url.includes('/auth/')) {
        return throwError(() => error);
      }
      // The access token expired mid-session: renew it quietly and replay the
      // request, so the user's tap simply works.
      return authService.renewSession().pipe(
        switchMap((result) => {
          if (result === 'ok') return next(authReq);
          if (result === 'denied') authService.sessionExpired();
          return throwError(() => error);
        }),
      );
    }),
  );
};
