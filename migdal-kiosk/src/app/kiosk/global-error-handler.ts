// src/app/kiosk/global-error-handler.ts
import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { ApiStatusService } from './status/api-status.service';
import { KioskConfigService } from '../config/kiosk-config.service';


@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  constructor(
    private injector: Injector,
    private kioskCfg: KioskConfigService,
  ) { }

  handleError(error: unknown): void {
    // Log to console (you can replace with server logging)
    // eslint-disable-next-line no-console
    console.error('GlobalErrorHandler:', error);

    const router = this.injector.get(Router);
    const apiStatus = this.injector.get(ApiStatusService);

    apiStatus.setLastAppError(error);

    // Avoid infinite loops if error page itself throws
    if (router.url !== this.kioskCfg.config.ERROR_URL) {
      router.navigateByUrl(this.kioskCfg.config.ERROR_URL);
    }
  }
}
