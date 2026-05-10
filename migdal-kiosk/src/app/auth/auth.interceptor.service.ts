// import {
//   HttpErrorResponse,
//   HttpEvent,
//   HttpHandler,
//   HttpInterceptor,
//   HttpRequest,
//   HTTP_INTERCEPTORS,
// } from '@angular/common/http';
// import { Injectable, Provider } from '@angular/core';
// import {
//   BehaviorSubject,
//   Observable,
//   catchError,
//   filter,
//   switchMap,
//   take,
//   throwError,
// } from 'rxjs';
// import { AuthService } from './auth.service';

// @Injectable()
// export class AuthInterceptor implements HttpInterceptor {

//   private refreshInProgress = false;
//   private refreshDone$ = new BehaviorSubject<string | null>(null);

//   constructor(private auth: AuthService) { }

//   intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
//     const token = this.auth.getAccessToken();
//     const authReq = token ? this.addAuth(req, token) : req;

//     return next.handle(authReq).pipe(
//       catchError((err: any) => {
//         if (err instanceof HttpErrorResponse && err.status === 401) {
//           return this.handle401(authReq, next);
//         }
//         return throwError(() => err);
//       }),
//     );
//   }

//   private handle401(req: HttpRequest<any>, next: HttpHandler) {
//     if (!this.refreshInProgress) {
//       this.refreshInProgress = true;
//       this.refreshDone$.next(null);

//       return this.auth.refreshTokens().pipe(
//         switchMap((res) => {
//           this.refreshInProgress = false;
//           this.refreshDone$.next(res.accessToken);
//           return next.handle(this.addAuth(req, res.accessToken));
//         }),
//         catchError((e) => {
//           this.refreshInProgress = false;
//           this.auth.logoutDevice();
//           return throwError(() => e);
//         }),
//       );
//     }

//     return this.refreshDone$.pipe(
//       filter((t) => !!t),
//       take(1),
//       switchMap((t) => next.handle(this.addAuth(req, t!))),
//     );
//   }

//   private addAuth(req: HttpRequest<any>, token: string) {
//     return req.clone({
//       setHeaders: { Authorization: `Bearer ${token}` },
//     });
//   }
// }

// export const AUTH_INTERCEPTOR_PROVIDER: Provider = {
//   provide: HTTP_INTERCEPTORS,
//   useClass: AuthInterceptor,
//   multi: true,
// };
