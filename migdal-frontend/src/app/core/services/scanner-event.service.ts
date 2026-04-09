import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WorkstationSessionService } from './workstation-session.service';
import { WsEvent } from '../websocket/ws-events.enum';
import {
    ScannerActionCompletedPayload,
    ScannerActionFailedPayload,
} from '../models/ws-payloads.model';

export interface ScanResultData {
    personId: string;
    firstName: string;
    lastName: string;
    identifyNumber: string;
    image: string;
}

export interface ScannerEventState {
    lastResult: ScanResultData | null;
    lastError: string | null;
    correlationId: string | null;
}

const INITIAL_STATE: ScannerEventState = {
    lastResult: null,
    lastError: null,
    correlationId: null,
};

@Injectable({ providedIn: 'root' })
export class ScannerEventService {
    private readonly stateSubject = new BehaviorSubject<ScannerEventState>(INITIAL_STATE);
    readonly state$ = this.stateSubject.asObservable();
    private subscriptions: Subscription[] = [];

    constructor(
        private userWs: UserWebSocketService,
        private workstationSession: WorkstationSessionService,
    ) { }

    initListeners(): void {
        if (this.subscriptions.length > 0) return;

        this.subscriptions.push(
            this.workstationSession.state$.subscribe((wsState) => {
                if (wsState.bound) {
                    this.subscribeToScannerEvents();
                } else {
                    this.unsubscribeFromScannerEvents();
                }
            }),
        );
    }

    reset(): void {
        this.unsubscribeFromScannerEvents();
        for (const sub of this.subscriptions) {
            sub.unsubscribe();
        }
        this.subscriptions = [];
        this.stateSubject.next(INITIAL_STATE);
    }

    get currentState(): ScannerEventState {
        return this.stateSubject.value;
    }

    private scannerSubs: Subscription[] = [];

    private subscribeToScannerEvents(): void {
        if (this.scannerSubs.length > 0) return;

        this.scannerSubs.push(
            this.userWs.on<ScannerActionCompletedPayload>(WsEvent.ScannerActionCompleted).subscribe((data) => {
                const result = data.result as unknown as ScanResultData;
                this.stateSubject.next({
                    lastResult: result,
                    lastError: null,
                    correlationId: data.correlationId,
                });
            }),
        );

        this.scannerSubs.push(
            this.userWs.on<ScannerActionFailedPayload>(WsEvent.ScannerActionFailed).subscribe((data) => {
                this.stateSubject.next({
                    lastResult: null,
                    lastError: data.reason,
                    correlationId: data.correlationId,
                });
            }),
        );
    }

    private unsubscribeFromScannerEvents(): void {
        for (const sub of this.scannerSubs) {
            sub.unsubscribe();
        }
        this.scannerSubs = [];
    }
}
