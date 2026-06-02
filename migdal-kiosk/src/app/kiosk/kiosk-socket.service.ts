import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { KioskConfigService } from '../config/kiosk-config.service';

export interface ScanStatus {
  state: 'paperDetected' | 'scanning' | 'processing' | 'success' | 'error';
  message: string;
  scanning: string;
  processing: boolean;
  progress: number;
  serverTimeUtc: string;
}

export interface ScanResultData {
  personId: string;
  firstName: string;
  lastName: string;
  identifyNumber: string;
  image?: string;
}

export interface ScanResult {
  correlationId: string;
  success: boolean;
  result?: ScanResultData;
  errorMessage?: string;
}

export interface ScannerStatus {
  connected: boolean;
  deviceConnected: boolean;
}

@Injectable({ providedIn: 'root' })
export class KioskSocketService {
  private socket?: Socket;
  private started = false;

  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  private readonly _registered$ = new BehaviorSubject<boolean>(false);
  readonly registered$: Observable<boolean> = this._registered$.asObservable();

  private readonly _scanStatus$ = new Subject<ScanStatus>();
  readonly scanStatus$: Observable<ScanStatus> = this._scanStatus$.asObservable();

  private readonly _scanResults$ = new Subject<ScanResult>();
  readonly scanResults$: Observable<ScanResult> = this._scanResults$.asObservable();

  /** Buffered scan result for when /scan page isn't mounted yet */
  private _pendingScanResult: ScanResult | null = null;

  private readonly _scannerStatus$ = new Subject<ScannerStatus>();
  readonly scannerStatus$: Observable<ScannerStatus> = this._scannerStatus$.asObservable();

  constructor(
    private zone: NgZone,
    private kioskCfg: KioskConfigService
  ) { }

  connect(): void {
    if (this.started) return;

    const cfg = this.kioskCfg.config;
    const wsUrl = cfg.WS_URL;

    if (!wsUrl) {
      console.error('[WS] WS_URL not configured in kiosk-config.json');
      return;
    }

    if (!cfg.WORKSTATION_CODE) {
      console.warn('[WS] No WORKSTATION_CODE set — skipping WebSocket connection. Use ?workstation=CODE in the URL.');
      return;
    }

    this.socket = io(`${wsUrl}/ws/kiosk`, {
      transports: ['websocket'],
      auth: {
        apiKey: cfg.WS_API_KEY,
        kioskId: cfg.KIOSK_ID,
        workstationCode: cfg.WORKSTATION_CODE,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      this.started = true;
      this.zone.run(() => this._connected$.next(true));
      console.info('[WS] connected to /ws/kiosk:', this.socket?.id);

      // Register with backend
      this.socket!.emit('kiosk:register', {
        kioskId: cfg.KIOSK_ID,
        workstationCode: cfg.WORKSTATION_CODE,
      });
    });

    this.socket.on('disconnect', (reason) => {
      this.zone.run(() => {
        this._connected$.next(false);
        this._registered$.next(false);
      });
      console.warn('[WS] disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      this.zone.run(() => this._connected$.next(false));
      console.error('[WS] connection error:', err.message);
    });

    // Registration confirmed
    this.socket.on('kiosk:registered', (data: { kioskId: string; workstationCode: string }) => {
      this.zone.run(() => this._registered$.next(true));
      console.info('[WS] kiosk registered on workstation:', data.workstationCode);
    });

    // Scan status updates (scanner progress on our workstation)
    this.socket.on('kiosk:scan-status', (status: ScanStatus) => {
      this.zone.run(() => this._scanStatus$.next(status));
    });

    // Scan results (document scanned on our workstation)
    this.socket.on('kiosk:scan-result', (data: ScanResult) => {
      this.zone.run(() => {
        this._pendingScanResult = data;
        this._scanResults$.next(data);
      });
    });

    // Error from backend
    this.socket.on('kiosk:error', (data: { reason: string }) => {
      console.error('[WS] kiosk error:', data.reason);
    });

    // Scanner status response
    this.socket.on('kiosk:scanner-status', (data: ScannerStatus) => {
      console.info('[WS] scanner status:', data);
      this.zone.run(() => this._scannerStatus$.next(data));
    });
  }

  requestScan(): void {
    if (!this.socket?.connected) {
      console.warn('[WS] cannot request scan — not connected');
      return;
    }
    this.socket.emit('kiosk:request-scan', {
      kioskId: this.kioskCfg.config.KIOSK_ID,
    });
  }

  checkScannerStatus(): void {
    if (!this.socket?.connected) {
      console.warn('[WS] cannot check scanner — not connected');
      this._scannerStatus$.next({ connected: false, deviceConnected: false });
      return;
    }
    this.socket.emit('kiosk:check-scanner');
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }

    this.started = false;
    this._connected$.next(false);
    this._registered$.next(false);
  }

  /** Return and clear any buffered scan result (consumed by ScanComponent on init) */
  consumePendingScanResult(): ScanResult | null {
    const result = this._pendingScanResult;
    this._pendingScanResult = null;
    return result;
  }
}
