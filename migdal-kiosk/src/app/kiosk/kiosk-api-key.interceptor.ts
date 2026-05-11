import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { KioskConfigService } from '../config/kiosk-config.service';

@Injectable()
export class KioskApiKeyInterceptor implements HttpInterceptor {
    constructor(private kioskCfg: KioskConfigService) { }

    intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        const baseUrl = this.kioskCfg.config?.API_BASE_URL;
        const apiKey = this.kioskCfg.config?.WS_API_KEY;
        if (apiKey && baseUrl && req.url.startsWith(baseUrl)) {
            const cloned = req.clone({
                setHeaders: { 'x-kiosk-api-key': apiKey },
            });
            return next.handle(cloned);
        }
        return next.handle(req);
    }
}
