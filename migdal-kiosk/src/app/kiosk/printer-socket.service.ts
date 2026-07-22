import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { KioskConfigService } from '../config/kiosk-config.service';

export interface PrinterStatus {
  connected: boolean;
  deviceConnected: boolean;
  sdkInitialized: boolean;
}

export interface PrintResult {
  correlationId: string;
  success: boolean;
  errorMessage?: string;
}

const RECONNECT_DELAY_MS = 2000;
const RECONNECT_DELAY_MAX_MS = 10000;

/**
 * Connects directly to the printer service's local WebSocket server
 * (on a paired workstation on the same LAN) — no backend involved.
 */
@Injectable({ providedIn: 'root' })
export class PrinterSocketService {
  private socket?: WebSocket;
  private started = false;
  private manuallyDisconnected = false;
  private reconnectAttempt = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  private readonly _registered$ = new BehaviorSubject<boolean>(false);
  readonly registered$: Observable<boolean> = this._registered$.asObservable();

  private readonly _printerStatus$ = new Subject<PrinterStatus>();
  readonly printerStatus$: Observable<PrinterStatus> = this._printerStatus$.asObservable();

  private readonly _printResult$ = new Subject<PrintResult>();
  readonly printResult$: Observable<PrintResult> = this._printResult$.asObservable();

  constructor(
    private zone: NgZone,
    private kioskCfg: KioskConfigService
  ) { }

  connect(): void {
    if (this.started) return;

    const cfg = this.kioskCfg.config;
    if (!cfg.PRINTER_HOST || !cfg.PRINTER_PORT) {
      console.error('[Printer] PRINTER_HOST/PRINTER_PORT not configured in kiosk-config.json');
      return;
    }

    this.started = true;
    this.manuallyDisconnected = false;
    this.openSocket();
  }

  private openSocket(): void {
    const cfg = this.kioskCfg.config;
    const url = `ws://${cfg.PRINTER_HOST}:${cfg.PRINTER_PORT}/printer/`;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.info('[Printer] connected:', url);
      this.reconnectAttempt = 0;
      this.zone.run(() => this._connected$.next(true));
      this.send({ type: 'hello', token: cfg.PRINTER_TOKEN });
    };

    this.socket.onclose = (event) => {
      this.zone.run(() => {
        this._connected$.next(false);
        this._registered$.next(false);
      });
      console.warn('[Printer] disconnected:', event.reason || event.code);
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      this.zone.run(() => this._connected$.next(false));
      console.error('[Printer] connection error');
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
      console.error('[Printer] received malformed message:', raw);
      return;
    }

    switch (msg.type) {
      case 'hello-ack':
        this.zone.run(() => this._registered$.next(true));
        console.info('[Printer] handshake accepted');
        break;

      case 'hello-reject':
        console.error('[Printer] handshake rejected:', msg.reason);
        this.zone.run(() => this._registered$.next(false));
        break;

      case 'status': {
        const status: PrinterStatus = {
          connected: !!msg.connected,
          deviceConnected: !!msg.deviceConnected,
          sdkInitialized: !!msg.sdkInitialized,
        };
        this.zone.run(() => this._printerStatus$.next(status));
        break;
      }

      case 'print-ack':
        // Print command acknowledged by the printer; result follows separately.
        break;

      case 'print-result': {
        const result: PrintResult = {
          correlationId: msg.correlationId,
          success: !!msg.success,
          errorMessage: msg.errorMessage,
        };
        this.zone.run(() => this._printResult$.next(result));
        break;
      }

      default:
        console.warn('[Printer] unknown message type:', msg.type);
    }
  }

  sendPrintJob(correlationId: string, printData: unknown, printOptions?: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[Printer] cannot send print job — not connected');
      return;
    }
    this.send({ type: 'print-card', correlationId, printData, printOptions });
  }

  checkStatus(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[Printer] cannot check status — not connected');
      this._printerStatus$.next({ connected: false, deviceConnected: false, sdkInitialized: false });
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
}
