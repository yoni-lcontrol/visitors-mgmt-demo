import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { KioskConfig } from './kiosk-config.model';

@Injectable({ providedIn: 'root' })
export class KioskConfigService {

  private _config: KioskConfig = {
    KIOSK_ID: '',
    WORKSTATION_CODE: '',
    HOME_URL: '/home',
    ERROR_URL: '/error',
    IDLE_TIMEOUT_MS: 120000,
    ENABLE_RELOAD_ON_IDLE: false,
    RELOAD_AFTER_IDLE_MS: 1800000,
    APP_VERSION: '0.0.0',
    API_BASE_URL: '',
    WS_API_KEY: '',
    SCANNER_HOST: 'localhost',
    SCANNER_PORT: 5900,
    SCANNER_TOKEN: '',
    PRINTER_HOST: 'localhost',
    PRINTER_PORT: 5901,
    PRINTER_TOKEN: '',
    HEARTBEAT_INTERVAL_MS: 30000,
  };

  constructor(private http: HttpClient) { }

  async load(): Promise<void> {
    const url = `assets/kiosk-config.json?v=${Date.now()}`;

    try {
      // Fetch as TEXT first, then JSON.parse ourselves (better error diagnostics)
      const text = await firstValueFrom(
        this.http.get(url, { responseType: 'text' })
      );

      this._config = { ...this._config, ...JSON.parse(text) };
    } catch (e) {
      console.error('Failed to load/parse kiosk-config.json, using defaults.', e);
    }

    // Override KIOSK_ID and WORKSTATION_CODE from URL query params or localStorage
    const params = new URLSearchParams(window.location.search);
    const workstation = params.get('workstation');
    if (workstation) {
      this._config.WORKSTATION_CODE = workstation;
      this._config.KIOSK_ID = workstation;
      localStorage.setItem('KIOSK_WORKSTATION', workstation);
    } else {
      const stored = localStorage.getItem('KIOSK_WORKSTATION');
      if (stored) {
        this._config.WORKSTATION_CODE = stored;
        this._config.KIOSK_ID = stored;
      }
    }
  }

  get config(): KioskConfig {
    return this._config;
  }
}