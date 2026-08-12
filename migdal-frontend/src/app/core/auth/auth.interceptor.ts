import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const AUTH_URLS = ['/auth/login', '/auth/refresh'];

function isAuthUrl(url: string): boolean {
    return AUTH_URLS.some((authUrl) => url.includes(authUrl));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const tokenService = inject(TokenService);
    const authService = inject(AuthService);

    if (isAuthUrl(req.url)) {
        return next(req);
    }

    const token = tokenService.getAccessToken();
    const authReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401) {
                return handle401(req, next, authService, tokenService);
            }
            return throwError(() => error);
        }),
    );
};

function handle401(
    req: HttpRequest<unknown>,
    next: HttpHandlerFn,
    authService: AuthService,
    tokenService: TokenService,
): Observable<any> {
    if (!isRefreshing) {
        isRefreshing = true;
        refreshTokenSubject.next(null);

        return authService.refreshToken().pipe(
            switchMap((response) => {
                isRefreshing = false;
                refreshTokenSubject.next(response.accessToken);
                return next(req.clone({
                    setHeaders: { Authorization: `Bearer ${response.accessToken}` },
                }));
            }),
            catchError((refreshError) => {
                isRefreshing = false;
                refreshTokenSubject.next(null);
                authService.handleAuthFailure();
                return throwError(() => refreshError);
            }),
        );
    }

    // Another refresh is already in progress — wait for it
    return refreshTokenSubject.pipe(
        filter((token): token is string => token !== null),
        take(1),
        switchMap((newToken) =>
            next(req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
            })),
        ),
    );
}
