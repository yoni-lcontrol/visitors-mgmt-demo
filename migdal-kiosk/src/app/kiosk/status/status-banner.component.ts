import { Component } from '@angular/core';
import { NetworkService } from './network.service';
import { ApiStatusService } from './api-status.service';
import { KioskConfigService } from '../../config/kiosk-config.service';

@Component({
  selector: 'app-status-banner',
  template: `
    <div class="banner" *ngIf="(online$ | async) === false">
      Offline / No network
    </div>

    <div class="banner warn" *ngIf="(lastApiError$ | async) as err">
      API issue: {{ err }}
    </div>

    <div class="version">
      v{{ version }}
    </div>
  `,
  styles: [`
    .banner { position: fixed; top: 0; left: 0; right: 0; padding: 10px; font-size: 18px; z-index: 9999; background: #1B1464; color: #fff; text-align: center; }
    .warn { background: #2B2870; }
    .version { position: fixed; bottom: 8px; right: 10px; opacity: 0.5; font-size: 12px; color: #6B68A0; }
  `],
})
export class StatusBannerComponent {

  online$ = this.network.online$;
  lastApiError$ = this.apiStatus.lastApiError$;
  version = this.kioskCfg.config.APP_VERSION;

  constructor(
    private network: NetworkService,
    private apiStatus: ApiStatusService,
    private kioskCfg: KioskConfigService
  ) { }
}
