import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { VisitResponse } from '../models/kiosk-api.models';

export type KioskStep = 'home' | 'check-in' | 'scan' | 'details' | 'consent' | 'success';

interface KioskFlowState {
  visit: VisitResponse | null;
  scanPassed: boolean;
  detailsConfirmed: boolean;
}

const STORAGE_KEY = 'kiosk_flow_state_v1';

@Injectable({ providedIn: 'root' })
export class KioskFlowService {
  private readonly _state$ = new BehaviorSubject<KioskFlowState>(this.load());

  readonly state$ = this._state$.asObservable();

  get state(): KioskFlowState {
    return this._state$.value;
  }

  get visit(): VisitResponse | null {
    return this.state.visit;
  }

  setVisit(visit: VisitResponse): void {
    this.setState({ visit, scanPassed: false, detailsConfirmed: false });
  }

  setScanPassed(): void {
    this.setState({ ...this.state, scanPassed: true });
  }

  setDetailsConfirmed(): void {
    this.setState({ ...this.state, detailsConfirmed: true });
  }

  reset(): void {
    this.setState({ visit: null, scanPassed: false, detailsConfirmed: false });
  }

  private setState(next: KioskFlowState): void {
    this._state$.next(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  updateVisitor(patch: Partial<VisitResponse['visitor']>): void {
    const current = this.state.visit;
    if (!current) return;

    const nextVisit: VisitResponse = {
      ...current,
      visitor: {
        ...current.visitor,
        ...patch,
      },
    };

    this.setState({
      ...this.state,
      visit: nextVisit,
    });
  }

  private load(): KioskFlowState {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { visit: null, scanPassed: false, detailsConfirmed: false };
    } catch {
      return { visit: null, scanPassed: false, detailsConfirmed: false };
    }
  }
}