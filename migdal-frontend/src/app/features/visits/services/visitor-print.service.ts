import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, filter, take, takeUntil, timeout } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { UserWebSocketService } from '../../../core/websocket/user-websocket.service';
import { WsEvent } from '../../../core/websocket/ws-events.enum';
import {
    VisitorPrintQueuedPayload,
    VisitorPrintStartedPayload,
    VisitorPrintCompletedPayload,
    VisitorPrintFailedPayload,
} from '../../../core/models/ws-payloads.model';

export interface PrintCardRequest {
    visitId: string;
    visitorId: string;
    cardTemplateId?: string;
    printOptions?: Record<string, unknown>;
}

export type PrintStatus = 'idle' | 'requesting' | 'queued' | 'printing' | 'completed' | 'failed';

export interface PrintState {
    status: PrintStatus;
    correlationId: string | null;
    errorMessage: string | null;
}

const INITIAL_STATE: PrintState = { status: 'idle', correlationId: null, errorMessage: null };

@Injectable()
export class VisitorPrintService {
    private readonly stateSubject = new BehaviorSubject<PrintState>(INITIAL_STATE);
    readonly state$ = this.stateSubject.asObservable();
    private subscribed = false;
    private api = inject(ApiService);

    constructor(private userWs: UserWebSocketService) { }

    initListeners(): void {
        if (this.subscribed) return;
        this.subscribed = true;

        this.userWs.on<VisitorPrintQueuedPayload>(WsEvent.VisitsVisitorPrintQueued).subscribe((data) => {
            this.stateSubject.next({
                status: 'queued',
                correlationId: data.correlationId,
                errorMessage: null,
            });
        });

        this.userWs.on<VisitorPrintStartedPayload>(WsEvent.VisitsVisitorPrintStarted).subscribe((data) => {
            this.stateSubject.next({
                status: 'printing',
                correlationId: data.correlationId,
                errorMessage: null,
            });
        });

        this.userWs.on<VisitorPrintCompletedPayload>(WsEvent.VisitsVisitorPrintCompleted).subscribe((data) => {
            this.stateSubject.next({
                status: 'completed',
                correlationId: data.correlationId,
                errorMessage: null,
            });
            // Auto-reset after 3 seconds
            setTimeout(() => {
                if (this.stateSubject.value.status === 'completed') {
                    this.stateSubject.next(INITIAL_STATE);
                }
            }, 3000);
        });

        this.userWs.on<VisitorPrintFailedPayload>(WsEvent.VisitsVisitorPrintFailed).subscribe((data) => {
            this.stateSubject.next({
                status: 'failed',
                correlationId: data.correlationId,
                errorMessage: data.reason,
            });
        });
    }

    requestPrint(payload: PrintCardRequest): void {
        this.stateSubject.next({
            status: 'requesting',
            correlationId: null,
            errorMessage: null,
        });

        const body: Record<string, unknown> = {};
        if (payload.cardTemplateId) body['cardTemplateId'] = payload.cardTemplateId;
        if (payload.printOptions) body['printOptions'] = payload.printOptions;

        this.api.post<{ correlationId: string; status: string }>(
            `/visits/${payload.visitId}/visitors/${payload.visitorId}/print-card`,
            body,
        ).subscribe({
            next: (res) => {
                this.stateSubject.next({
                    status: 'queued',
                    correlationId: res.correlationId,
                    errorMessage: null,
                });
            },
            error: (err) => {
                const message = err?.error?.error?.message || err?.message || 'VISITS.PRINT_CARD_FAILED';
                this.stateSubject.next({
                    status: 'failed',
                    correlationId: null,
                    errorMessage: message,
                });
            },
        });
    }

    reset(): void {
        this.stateSubject.next(INITIAL_STATE);
    }

    get currentState(): PrintState {
        return this.stateSubject.value;
    }

    get isProcessing(): boolean {
        const s = this.stateSubject.value.status;
        return s === 'requesting' || s === 'queued' || s === 'printing';
    }
}
