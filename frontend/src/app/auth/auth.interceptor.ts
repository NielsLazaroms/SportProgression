import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './data-access/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Add withCredentials to all requests so cookies are sent
  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error) => {
      // Don't retry refresh or login-related requests to avoid infinite loops
      if (
        error.status === 401 &&
        !req.url.includes('/auth/refresh') &&
        !req.url.includes('/auth/me')
      ) {
        const authService = inject(AuthService);
        return authService.refresh().pipe(
          switchMap((success) => {
            if (success) {
              // Retry the original request — new cookies are set
              return next(authReq);
            }
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
