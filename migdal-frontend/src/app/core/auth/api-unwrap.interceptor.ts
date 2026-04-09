import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

export const apiUnwrapInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req).pipe(
        map((event) => {
            if (
                event instanceof HttpResponse &&
                event.body &&
                typeof event.body === 'object' &&
                'success' in event.body &&
                'data' in event.body
            ) {
                return event.clone({ body: (event.body as Record<string, unknown>)['data'] });
            }
            return event;
        }),
    );
};
