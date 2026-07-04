import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from 'environments/environment';

// Shared across requests so concurrent 401s trigger a single refresh call, not one per request.
let refreshInProgress$: Observable<string | null> | null = null;

const AUTH_EXEMPT_PATHS = ['/auth/login', '/auth/callback', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiUrl);
  const isExempt = AUTH_EXEMPT_PATHS.some(path => req.url.includes(path));

  const token = authService.getToken();
  const authorizedReq = (isApiRequest && !isExempt && token)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !isApiRequest || isExempt) {
        return throwError(() => error);
      }

      if (!refreshInProgress$) {
        refreshInProgress$ = authService.refreshAccessToken();
      }

      return refreshInProgress$.pipe(
        switchMap(newToken => {
          refreshInProgress$ = null;
          if (!newToken) {
            router.navigate(['/login']);
            return throwError(() => error);
          }
          const retriedReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
          return next(retriedReq);
        }),
        catchError(refreshError => {
          refreshInProgress$ = null;
          router.navigate(['/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
