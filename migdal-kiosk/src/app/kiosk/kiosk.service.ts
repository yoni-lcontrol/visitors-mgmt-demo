import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { distinctUntilChanged, filter } from 'rxjs/operators';
import { IdleService } from './idle.service';
import { KioskConfigService } from '../config/kiosk-config.service';

@Injectable({ providedIn: 'root' })
export class KioskService {

  constructor(
    private router: Router,
    private idle: IdleService,
    private kioskCfg: KioskConfigService
  ) { }

  init(): void {
    // Start idle tracking
    this.idle.start(this.kioskCfg.config.IDLE_TIMEOUT_MS);

    // When idle becomes true -> go home ONCE
    this.idle.isIdle$
      .pipe(
        distinctUntilChanged(),
        filter((idle) => idle === true)
      )
      .subscribe(() => {
        if (this.router.url !== this.kioskCfg.config.HOME_URL) {
          this.router.navigateByUrl(this.kioskCfg.config.HOME_URL);
        }
      });

    // Disable context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault(), { passive: false });
  }
}
