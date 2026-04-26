import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WsEvent } from '../websocket/ws-events.enum';

export interface AdSyncProgress {
  phase: 'idle' | 'fetching' | 'processing' | 'completed' | 'failed';
  message: string;
  current: number;
  total: number;
  percent: number;
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
}

export interface AdSyncCompletedEvent {
  configsProcessed: number;
  configsFailed: number;
  totalCreated: number;
  totalUpdated: number;
  totalDeactivated: number;
  totalSkipped: number;
  durationMs: number;
  details: { configName: string; error: string | null }[];
}

const IDLE_STATE: AdSyncProgress = {
  phase: 'idle',
  message: '',
  current: 0,
  total: 0,
  percent: 0,
  created: 0,
  updated: 0,
  deactivated: 0,
  skipped: 0,
};

@Injectable({ providedIn: 'root' })
export class AdSyncProgressService implements OnDestroy {
  private subs: Subscription[] = [];
  private initialized = false;

  readonly progress$ = new BehaviorSubject<AdSyncProgress>(IDLE_STATE);
  readonly completed$ = new BehaviorSubject<AdSyncCompletedEvent | null>(null);

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
        created: number;
        updated: number;
        deactivated: number;
        skipped: number;
      }>(WsEvent.AdSyncProgress).subscribe((data) => {
        this.progress$.next({
          phase: data.phase as AdSyncProgress['phase'],
          message: data.message,
          current: data.current,
          total: data.total,
          percent: data.total > 0 ? Math.round((data.current / data.total) * 100) : 0,
          created: data.created,
          updated: data.updated,
          deactivated: data.deactivated,
          skipped: data.skipped,
        });
      }),

      this.ws.on<AdSyncCompletedEvent>(WsEvent.AdSyncCompleted).subscribe((data) => {
        this.progress$.next({
          phase: 'completed',
          message: '',
          current: 0,
          total: 0,
          percent: 100,
          created: data.totalCreated,
          updated: data.totalUpdated,
          deactivated: data.totalDeactivated,
          skipped: data.totalSkipped,
        });
        this.completed$.next(data);

        // Auto-dismiss after 5s
        setTimeout(() => {
          if (this.progress$.value.phase === 'completed') {
            this.progress$.next(IDLE_STATE);
          }
        }, 5000);
      }),

      this.ws.on<{ message: string }>(WsEvent.AdSyncFailed).subscribe((data) => {
        this.progress$.next({
          phase: 'failed',
          message: data.message,
          current: 0,
          total: 0,
          percent: 0,
          created: 0,
          updated: 0,
          deactivated: 0,
          skipped: 0,
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
