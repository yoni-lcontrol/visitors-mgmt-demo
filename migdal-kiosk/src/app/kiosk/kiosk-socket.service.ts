import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
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

const RECONNECT_DELAY_MS = 2000;
const RECONNECT_DELAY_MAX_MS = 10000;

/**
 * Connects directly to the scanner service's local WebSocket server
 * (on a paired workstation on the same LAN) — no backend involved.
 */
@Injectable({ providedIn: 'root' })
export class KioskSocketService {
  private socket?: WebSocket;
  private started = false;
  private manuallyDisconnected = false;
  private reconnectAttempt = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

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
    if (!cfg.SCANNER_HOST || !cfg.SCANNER_PORT) {
      console.error('[Scanner] SCANNER_HOST/SCANNER_PORT not configured in kiosk-config.json');
      return;
    }

    this.started = true;
    this.manuallyDisconnected = false;
    this.openSocket();
  }

  private openSocket(): void {
    const cfg = this.kioskCfg.config;
    const url = `ws://${cfg.SCANNER_HOST}:${cfg.SCANNER_PORT}/scanner/`;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.info('[Scanner] connected:', url);
      this.reconnectAttempt = 0;
      this.zone.run(() => this._connected$.next(true));
      this.send({ type: 'hello', token: cfg.SCANNER_TOKEN });
    };

    this.socket.onclose = (event) => {
      this.zone.run(() => {
        this._connected$.next(false);
        this._registered$.next(false);
      });
      console.warn('[Scanner] disconnected:', event.reason || event.code);
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      this.zone.run(() => this._connected$.next(false));
      console.error('[Scanner] connection error');
    };

    this.socket.onmessage = (event) => this.handleMessage(event.data);
  }

  private scheduleReconnect(): void {
    if (this.manuallyDisconnected) return;

    this.reconnectAttempt++;
    const delay = Math.min(RECONNECT_DELAY_MS * this.reconnectAttempt, RECONNECT_DELAY_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      if (!this.manuallyDisconnected) this.openSocket();
    }, delay);
  }

  private handleMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.error('[Scanner] received malformed message:', raw);
      return;
    }

    switch (msg.type) {
      case 'hello-ack':
        this.zone.run(() => this._registered$.next(true));
        console.info('[Scanner] handshake accepted');
        break;

      case 'hello-reject':
        console.error('[Scanner] handshake rejected:', msg.reason);
        this.zone.run(() => this._registered$.next(false));
        break;

      case 'status': {
        const status: ScannerStatus = { connected: !!msg.connected, deviceConnected: !!msg.deviceConnected };
        this.zone.run(() => this._scannerStatus$.next(status));
        break;
      }

      case 'scan-status':
        this.zone.run(() => this._scanStatus$.next(msg as ScanStatus));
        break;

      case 'scan-result': {
        const result: ScanResult = {
          correlationId: msg.correlationId,
          success: msg.success,
          result: msg.result,
          errorMessage: msg.errorMessage,
        };
        this.zone.run(() => {
          this._pendingScanResult = result;
          this._scanResults$.next(result);
        });
        break;
      }

      default:
        console.warn('[Scanner] unknown message type:', msg.type);
    }
  }

  requestScan(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[Scanner] cannot request scan — not connected');
      return;
    }
    this.send({ type: 'request-scan' });
  }

  checkScannerStatus(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[Scanner] cannot check status — not connected');
      this._scannerStatus$.next({ connected: false, deviceConnected: false });
      return;
    }
    this.send({ type: 'check-status' });
  }

  private send(payload: unknown): void {
    this.socket?.send(JSON.stringify(payload));
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.socket) {
      this.socket.close();
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
