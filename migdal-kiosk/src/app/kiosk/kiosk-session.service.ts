// import { Injectable } from '@angular/core';
// import { BehaviorSubject } from 'rxjs';
// import { VisitResponse } from '../models/kiosk-api.models';

// @Injectable({ providedIn: 'root' })
// export class KioskSessionService {

//   private readonly _session$ = new BehaviorSubject<VisitResponse | null>(null);

//   readonly session$ = this._session$.asObservable();

//   get session(): VisitResponse | null {
//     return this._session$.value;
//   }

//   setSession(session: VisitResponse): void {
//     this._session$.next(session);
//   }

//   clear(): void {
//     this._session$.next(null);
//   }

//   /** Backward-compatible alias */
//   get visitResponse(): VisitResponse | null {
//     return this._session$.value;
//   }
// }
