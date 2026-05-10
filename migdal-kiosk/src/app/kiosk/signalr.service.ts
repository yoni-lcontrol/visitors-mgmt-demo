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

export interface ScanResult {
  error: boolean;
  personId: string;
  firstName: string;
  lastName: string;
  identifyNumber: string;
  image?: string;
}

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private socket?: Socket;
  private started = false;

  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  private readonly _scanStatus$ = new Subject<ScanStatus>();
  readonly scanStatus$: Observable<ScanStatus> = this._scanStatus$.asObservable();

  private readonly _scanResults$ = new Subject<ScanResult>();
  readonly scanResults$: Observable<ScanResult> = this._scanResults$.asObservable();

  constructor(
    private zone: NgZone,
    private kioskCfg: KioskConfigService
  ) { }

  connect(): void {
    if (this.started) return;

    const wsUrl = this.kioskCfg.config.WS_URL;
    const apiKey = this.kioskCfg.config.WS_API_KEY;

    if (!wsUrl) {
      console.error('[WS] WS_URL not configured in kiosk-config.json');
      return;
    }

    this.socket = io(`${wsUrl}/ws/agents`, {
      transports: ['websocket'],
      auth: { apiKey },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      this.started = true;
      this.zone.run(() => this._connected$.next(true));
      console.info('[WS] connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      this.zone.run(() => this._connected$.next(false));
      console.warn('[WS] disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      this.zone.run(() => this._connected$.next(false));
      console.error('[WS] connection error:', err.message);
    });

    this.socket.on('scanStatus', (status: ScanStatus) => {
      this.zone.run(() => this._scanStatus$.next(status));
    });

    this.socket.on('scanResult', (data: ScanResult) => {
      this.zone.run(() => this._scanResults$.next(data));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }

    this.started = false;
    this._connected$.next(false);
  }
}
