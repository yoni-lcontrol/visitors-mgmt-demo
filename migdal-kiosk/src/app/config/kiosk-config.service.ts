import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { KioskConfig } from './kiosk-config.model';

@Injectable({ providedIn: 'root' })
export class KioskConfigService {

  private _config!: KioskConfig;

  constructor(private http: HttpClient) { }

  async load(): Promise<void> {
    const url = `assets/kiosk-config.json?v=${Date.now()}`;

    try {
      // Fetch as TEXT first, then JSON.parse ourselves (better error diagnostics)
      const text = await firstValueFrom(
        this.http.get(url, { responseType: 'text' })
      );

      this._config = JSON.parse(text);
    } catch (e) {
      console.error('Failed to load/parse kiosk-config.json, using defaults.', e);
      // keep defaults
    }
  }

  get config(): KioskConfig {
    return this._config;
  }
}