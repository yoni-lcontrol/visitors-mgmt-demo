import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { ApiStatusService } from './api-status.service';

@Injectable()
export class ApiErrorInterceptor implements HttpInterceptor {
  constructor(private apiStatus: ApiStatusService) { }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((err) => {
        const message = err?.message ?? 'API error';
        this.apiStatus.setLastApiError(message);

        // Optional: auto-clear after a bit
        setTimeout(() => this.apiStatus.setLastApiError(null), 10_000);

        return throwError(() => err);
      })
    );
  }
}
