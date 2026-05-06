import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../notifications/notification.service';

const SILENT_STATUSES = [401]; // handled by auth interceptor

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const notification = inject(NotificationService);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (!SILENT_STATUSES.includes(error.status)) {
                notification.showHttpError(error);
            }
            return throwError(() => error);
        }),
    );
};
