import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WsEvent } from '../websocket/ws-events.enum';

export interface AcImportProgress {
  phase: 'idle' | 'fetching' | 'processing' | 'completed' | 'failed';
  message: string;
  current: number;
  total: number;
  percent: number;
  created: number;
  updated: number;
  skipped: number;
  serviceDown: boolean;
}

const IDLE_STATE: AcImportProgress = {
  phase: 'idle',
  message: '',
  current: 0,
  total: 0,
  percent: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  serviceDown: false,
};

@Injectable({ providedIn: 'root' })
export class AcImportProgressService implements OnDestroy {
  private subs: Subscription[] = [];
  private initialized = false;

  readonly progress$ = new BehaviorSubject<AcImportProgress>(IDLE_STATE);

  constructor(private ws: UserWebSocketService) {}

  initListeners(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.subs.push(
      this.ws.on<{
        phase: string;
        message: string;
        current: number;
        total: number;
      }>(WsEvent.AccessControlControllersImportProgress).subscribe((data) => {
        this.progress$.next({
          phase: data.phase as AcImportProgress['phase'],
          message: data.message,
          current: data.current,
          total: data.total,
          percent: data.total > 0 ? Math.round((data.current / data.total) * 100) : 0,
          created: this.progress$.value.created,
          updated: this.progress$.value.updated,
          skipped: this.progress$.value.skipped,
          serviceDown: false,
        });
      }),

      this.ws.on<{ created: number; updated: number; skipped: number; total: number }>(
        WsEvent.AccessControlControllersImportCompleted,
      ).subscribe((data) => {
        this.progress$.next({
          phase: 'completed',
          message: '',
          current: data.total,
          total: data.total,
          percent: 100,
          created: data.created,
          updated: data.updated,
          skipped: data.skipped,
          serviceDown: false,
        });

        // Auto-dismiss after 5s
        setTimeout(() => {
          if (this.progress$.value.phase === 'completed') {
            this.progress$.next(IDLE_STATE);
          }
        }, 5000);
      }),

      this.ws.on<{ message: string; serviceDown?: boolean }>(WsEvent.AccessControlControllersImportFailed).subscribe((data) => {
        this.progress$.next({
          phase: 'failed',
          message: data.message,
          current: 0,
          total: 0,
          percent: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          serviceDown: data.serviceDown ?? false,
        });

        setTimeout(() => {
          if (this.progress$.value.phase === 'failed') {
            this.progress$.next(IDLE_STATE);
          }
        }, 8000);
      }),
    );
  }

  get isActive(): boolean {
    const phase = this.progress$.value.phase;
    return phase === 'fetching' || phase === 'processing';
  }

  dismiss(): void {
    this.progress$.next(IDLE_STATE);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
  }
}
