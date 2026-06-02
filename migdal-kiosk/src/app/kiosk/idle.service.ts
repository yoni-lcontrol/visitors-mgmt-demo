import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, fromEvent, merge, timer } from 'rxjs';
import { filter, mapTo, switchMap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class IdleService implements OnDestroy {
  private readonly isIdleSubject = new BehaviorSubject<boolean>(false);
  readonly isIdle$ = this.isIdleSubject.asObservable();

  private sub?: Subscription;
  private timeoutMs = 60_000;
  private _paused = false;

  constructor(private zone: NgZone) { }

  /** Temporarily suppress idle detection (e.g. during async submissions) */
  pause(): void {
    this._paused = true;
    this.isIdleSubject.next(false);
  }

  /** Resume idle detection and reset the timer */
  resume(): void {
    this._paused = false;
    this.reset();
  }

  start(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;

    // If already started, restart cleanly
    this.stop();

    this.zone.runOutsideAngular(() => {
      // Events that count as "activity" on a kiosk
      const activity$ = merge(
        fromEvent(document, 'pointerdown'),
        fromEvent(document, 'pointermove'),
        fromEvent(document, 'touchstart'),
        fromEvent(document, 'touchmove'),
        fromEvent(document, 'mousedown'),
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'wheel'),
        fromEvent(document, 'scroll')
      ).pipe(
        // ignore synthetic scroll bursts if you want:
        filter(() => true),
        mapTo(false)
      );

      // Behavior:
      // - On ANY activity -> set idle=false and start a fresh timer
      // - If no activity for timeoutMs -> set idle=true
      this.sub = activity$
        .pipe(
          switchMap(() => {
            // user active => not idle
            if (this.isIdleSubject.value !== false) {
              this.isIdleSubject.next(false);
            }
            // restart timer
            return timer(this.timeoutMs).pipe(mapTo(true));
          })
        )
        .subscribe((idle) => {
          // Timer fired => idle=true (only if not paused)
          if (!this._paused) {
            this.zone.run(() => this.isIdleSubject.next(idle));
          }
        });

      // ✅ IMPORTANT: kick it off once so timer starts immediately
      // Treat app boot as an "activity" so timer starts now
      (this.isIdleSubject.value !== false) && this.isIdleSubject.next(false);
      // Manually trigger the pipeline once:
      // easiest way: dispatch a synthetic event-like call via startTimer helper
      this.reset();
    });
  }

  /** Call this when you want to manually reset idle timer */
  reset(): void {
    // Simulate "activity" by calling next through a temporary event:
    // easiest in this pattern is to restart start() logic by triggering a real event,
    // but we can just stop/start quickly:
    // However that would rebind listeners. So instead:
    // We just mark as not idle and rely on real activity to reset.
    // For kiosk, we can force a small trick: dispatch pointermove:
    try {
      document.dispatchEvent(new Event('pointermove'));
    } catch {
      // ignore
    }
  }

  stop(): void {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.isIdleSubject.next(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
