import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, merge } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly online$ = new BehaviorSubject<boolean>(navigator.onLine);

  init(): void {
    merge(
      fromEvent(window, 'online'),
      fromEvent(window, 'offline')
    ).subscribe(() => this.online$.next(navigator.onLine));
  }
}
