import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiStatusService {

  readonly lastApiError$ = new BehaviorSubject<string | null>(null);
  readonly lastAppError$ = new BehaviorSubject<string | null>(null);

  setLastApiError(message: string | null): void {
    this.lastApiError$.next(message);
  }

  setLastAppError(err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.lastAppError$.next(msg);
  }
}
