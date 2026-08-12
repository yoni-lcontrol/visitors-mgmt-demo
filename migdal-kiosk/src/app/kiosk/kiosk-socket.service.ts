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

export interface PrinterStatus {
  connected: boolean;
  deviceConnected: boolean;
}

export interface PrintStatus {
  correlationId: string;
  state: 'queued' | 'printing' | 'completed' | 'failed';
  message?: string;
  serverTimeUtc: string;
}

export interface PrintResult {
  correlationId: string;
  success: boolean;
  errorMessage?: string;
}

export interface KioskSocketError {
  reason: string;
}

/**
 * Reasons reported by the backend gateway that are permanent for this kiosk —
 * retrying with the same config can only fail the same way, so we stop reconnecting.
 * The gateway force-disconnects on these; soft errors ('Not registered',
 * 'No scanner agent connected', ...) leave the socket up and are just surfaced.
 */
const FATAL_ERROR_PATTERNS = ['api key', 'unknown workstation', 'missing', 'registration'];

/** How long a print result stays claimable by a caller that hasn't subscribed yet. */
const PRINT_RESULT_BUFFER_TTL_MS = 60000;

const RECONNECT_DELAY_MS = 2000;
const RECONNECT_DELAY_MAX_MS = 10000;

/**
 * Single Socket.IO link to the backend's /ws/kiosk namespace, serving both the
 * scanner and the printer. The device agents connect to the backend on their own
 * namespace; the backend relays between them and this kiosk. Reached at the same
 * origin as the SPA (a reverse proxy forwards /socket.io/* to the backend), unless
 * API_BASE_URL overrides it for local development.
 */
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

  private readonly _printerStatus$ = new Subject<PrinterStatus>();
  readonly printerStatus$: Observable<PrinterStatus> = this._printerStatus$.asObservable();

  private readonly _printStatus$ = new Subject<PrintStatus>();
  readonly printStatus$: Observable<PrintStatus> = this._printStatus$.asObservable();

  private readonly _printResult$ = new Subject<PrintResult>();
  readonly printResult$: Observable<PrintResult> = this._printResult$.asObservable();

  /** Print results keyed by correlationId, for callers that subscribe after the fact */
  private readonly _recentPrintResults = new Map<string, { result: PrintResult; at: number }>();

  private readonly _errors$ = new Subject<KioskSocketError>();
  readonly errors$: Observable<KioskSocketError> = this._errors$.asObservable();

  constructor(
    private zone: NgZone,
    private kioskCfg: KioskConfigService
  ) { }

  connect(): void {
    if (this.started) return;

    const cfg = this.kioskCfg.config;
    if (!cfg.WORKSTATION_CODE) {
      console.error('[KioskSocket] WORKSTATION_CODE not configured in kiosk-config.json');
      return;
    }

    this.started = true;
    this.openSocket();
  }

  private openSocket(): void {
    const cfg = this.kioskCfg.config;
    const origin = cfg.API_BASE_URL || window.location.origin;
    const url = `${origin}/ws/kiosk`;

    this.socket = io(url, {
      auth: { apiKey: cfg.WS_API_KEY },
      transports: ['websocket', 'polling'],
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
    });

    this.socket.on('connect', () => {
      console.info('[KioskSocket] connected to backend:', url);
      this.zone.run(() => this._connected$.next(true));
      // Re-register on every (re)connect — the backend keeps no state across sockets.
      this.socket?.emit('kiosk:register', {
        kioskId: cfg.KIOSK_ID || cfg.WORKSTATION_CODE,
        workstationCode: cfg.WORKSTATION_CODE,
      });
    });

    this.socket.on('disconnect', (reason: string) => {
      console.warn('[KioskSocket] disconnected:', reason);
      this.zone.run(() => {
        this._connected$.next(false);
        this._registered$.next(false);
      });
      // socket.io reconnects on its own for transient drops; nothing to schedule here.
    });

    this.socket.on('connect_error', (err: Error) => {
      const reason = err?.message ?? String(err);
      console.error('[KioskSocket] connection error:', reason);
      this.zone.run(() => {
        this._connected$.next(false);
        this._errors$.next({ reason });
      });
      // A handshake the backend rejected (bad API key) can only fail the same way again.
      // Plain transport errors — backend restarting, proxy blip — keep socket.io's backoff.
      if (this.isFatal(reason)) this.stopReconnecting();
    });

    this.socket.on('kiosk:registered', (payload: { kioskId: string; workstationCode: string }) => {
      console.info('[KioskSocket] registered:', payload?.workstationCode);
      this.zone.run(() => this._registered$.next(true));
    });

    this.socket.on('kiosk:error', (payload: KioskSocketError) => {
      const reason = payload?.reason ?? 'unknown error';
      console.error('[KioskSocket] error:', reason);
      this.zone.run(() => {
        this._errors$.next({ reason });
        if (this.isFatal(reason)) this._registered$.next(false);
      });
      if (this.isFatal(reason)) this.stopReconnecting();
    });

    this.socket.on('kiosk:scanner-status', (payload: Partial<ScannerStatus>) => {
      const status: ScannerStatus = {
        connected: !!payload?.connected,
        deviceConnected: !!payload?.deviceConnected,
      };
      this.zone.run(() => this._scannerStatus$.next(status));
    });

    this.socket.on('kiosk:printer-status', (payload: Partial<PrinterStatus>) => {
      const status: PrinterStatus = {
        connected: !!payload?.connected,
        deviceConnected: !!payload?.deviceConnected,
      };
      this.zone.run(() => this._printerStatus$.next(status));
    });

    this.socket.on('kiosk:scan-status', (payload: ScanStatus) => {
      this.zone.run(() => this._scanStatus$.next(payload));
    });

    this.socket.on('kiosk:scan-result', (payload: ScanResult) => {
      const result: ScanResult = {
        correlationId: payload?.correlationId,
        success: !!payload?.success,
        result: payload?.result,
        errorMessage: payload?.errorMessage,
      };
      this.zone.run(() => {
        this._pendingScanResult = result;
        this._scanResults$.next(result);
      });
    });

    this.socket.on('kiosk:print-status', (payload: PrintStatus) => {
      this.zone.run(() => this._printStatus$.next(payload));
    });

    this.socket.on('kiosk:print-result', (payload: PrintResult) => {
      const result: PrintResult = {
        correlationId: payload?.correlationId,
        success: !!payload?.success,
        errorMessage: payload?.errorMessage,
      };
      this.zone.run(() => {
        this.bufferPrintResult(result);
        this._printResult$.next(result);
      });
    });
  }

  private isFatal(reason: string): boolean {
    const lowered = (reason ?? '').toLowerCase();
    return FATAL_ERROR_PATTERNS.some((pattern) => lowered.includes(pattern));
  }

  /** Give up on automatic reconnection — the failure is a config problem, not a blip. */
  private stopReconnecting(): void {
    this.socket?.io.reconnection(false);
  }

  requestScan(): void {
    if (!this.socket?.connected) {
      console.warn('[KioskSocket] cannot request scan — not connected');
      return;
    }
    const cfg = this.kioskCfg.config;
    this.socket.emit('kiosk:request-scan', { kioskId: cfg.KIOSK_ID || cfg.WORKSTATION_CODE });
  }

  checkScannerStatus(): void {
    if (!this.socket?.connected) {
      console.warn('[KioskSocket] cannot check scanner status — not connected');
      this._scannerStatus$.next({ connected: false, deviceConnected: false });
      return;
    }
    this.socket.emit('kiosk:check-scanner');
  }

  checkPrinterStatus(): void {
    if (!this.socket?.connected) {
      console.warn('[KioskSocket] cannot check printer status — not connected');
      this._printerStatus$.next({ connected: false, deviceConnected: false });
      return;
    }
    this.socket.emit('kiosk:check-printer');
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = undefined;
    }

    this.started = false;
    this._pendingScanResult = null;
    this._recentPrintResults.clear();
    this._connected$.next(false);
    this._registered$.next(false);
  }

  /**
   * Return and clear a print result that landed before the caller could subscribe.
   * Printing is triggered over REST, so a fast (often failing) result can beat the
   * HTTP response that hands us the correlationId.
   */
  consumePrintResult(correlationId: string): PrintResult | null {
    const entry = this._recentPrintResults.get(correlationId);
    if (!entry) return null;
    this._recentPrintResults.delete(correlationId);
    return Date.now() - entry.at <= PRINT_RESULT_BUFFER_TTL_MS ? entry.result : null;
  }

  private bufferPrintResult(result: PrintResult): void {
    if (!result.correlationId) return;
    const now = Date.now();
    for (const [id, entry] of this._recentPrintResults) {
      if (now - entry.at > PRINT_RESULT_BUFFER_TTL_MS) this._recentPrintResults.delete(id);
    }
    this._recentPrintResults.set(result.correlationId, { result, at: now });
  }

  /** Return and clear any buffered scan result (consumed by ScanComponent on init) */
  consumePendingScanResult(): ScanResult | null {
    const result = this._pendingScanResult;
    this._pendingScanResult = null;
    return result;
  }
}
