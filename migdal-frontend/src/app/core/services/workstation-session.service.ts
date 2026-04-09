import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from '../api/api.service';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WsEvent } from '../websocket/ws-events.enum';
import {
    WorkstationBindSuccessPayload,
    WorkstationDeviceStatus,
} from '../models/ws-payloads.model';

export interface WorkstationState {
    bound: boolean;
    workstationId: string | null;
    code: string | null;
    displayName: string | null;
    devices: WorkstationDeviceStatus[];
    error: string | null;
}

const INITIAL_STATE: WorkstationState = {
    bound: false,
    workstationId: null,
    code: null,
    displayName: null,
    devices: [],
    error: null,
};

@Injectable({ providedIn: 'root' })
export class WorkstationSessionService {
    private readonly stateSubject = new BehaviorSubject<WorkstationState>(INITIAL_STATE);
    readonly state$ = this.stateSubject.asObservable();
    private subscribed = false;
    private api = inject(ApiService);

    constructor(private userWs: UserWebSocketService) { }

    /**
     * Initialize listeners on the user WebSocket for device-status events.
     * Should be called after UserWebSocketService.connect().
     */
    initListeners(): void {
        if (this.subscribed) return;
        this.subscribed = true;

        // Listen for device status updates pushed by the server
        this.userWs.on<WorkstationBindSuccessPayload>(WsEvent.WorkstationBindSuccess).subscribe((data) => {
            this.stateSubject.next({
                bound: true,
                workstationId: data.workstationId,
                code: data.code,
                displayName: data.displayName,
                devices: data.devices,
                error: null,
            });
        });
    }

    /**
     * Restore the active workstation session from the backend (e.g. after page reload).
     */
    restoreSession(): void {
        this.api.get<WorkstationBindSuccessPayload | null>('/workstations/session/current').subscribe({
            next: (data) => {
                if (data && data.workstationId) {
                    this.stateSubject.next({
                        bound: true,
                        workstationId: data.workstationId,
                        code: data.code,
                        displayName: data.displayName,
                        devices: data.devices,
                        error: null,
                    });
                }
            },
            error: () => {
                // Silently ignore — user may not have a session
            },
        });
    }

    bindToWorkstation(workstationId: string): void {
        this.api.post<WorkstationBindSuccessPayload>('/workstations/bind', { workstationId }).subscribe({
            next: (data) => {
                this.stateSubject.next({
                    bound: true,
                    workstationId: data.workstationId,
                    code: data.code,
                    displayName: data.displayName,
                    devices: data.devices,
                    error: null,
                });
            },
            error: (err) => {
                const reason = err?.error?.message || err?.message || 'Bind failed';
                this.stateSubject.next({
                    ...this.stateSubject.value,
                    bound: false,
                    error: reason,
                });
            },
        });
    }

    requestDeviceStatus(): void {
        this.userWs.emit(WsEvent.DevicesStatusGetCurrent, {});
    }

    get currentState(): WorkstationState {
        return this.stateSubject.value;
    }

    isPrinterConnected(): boolean {
        return this.stateSubject.value.devices.some(
            (d) => d.providerType === 'printer' && d.isConnected,
        );
    }

    isScannerConnected(): boolean {
        return this.stateSubject.value.devices.some(
            (d) => d.providerType === 'scanner' && d.isConnected,
        );
    }

    reset(): void {
        this.stateSubject.next(INITIAL_STATE);
        this.subscribed = false;
    }
}
