import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { UserWebSocketService } from '../websocket/user-websocket.service';
import { WorkstationSessionService } from './workstation-session.service';
import { WsEvent } from '../websocket/ws-events.enum';
import {
    DeviceStatusChangedPayload,
    DevicesStatusCurrentPayload,
    WorkstationDeviceStatus,
} from '../models/ws-payloads.model';

@Injectable({ providedIn: 'root' })
export class DeviceStatusService {
    private readonly devicesSubject = new BehaviorSubject<WorkstationDeviceStatus[]>([]);
    readonly devices$ = this.devicesSubject.asObservable();
    private subscribed = false;
    private wsSubs: Subscription[] = [];

    constructor(
        private userWs: UserWebSocketService,
        private workstationSession: WorkstationSessionService,
    ) { }

    initListeners(): void {
        if (this.subscribed) return;
        this.subscribed = true;

        // Subscribe/unsubscribe to WS device events based on workstation bound state
        this.workstationSession.state$.subscribe((state) => {
            if (state.bound) {
                this.devicesSubject.next(state.devices);
                this.subscribeToWsEvents();
            } else {
                this.devicesSubject.next([]);
                this.unsubscribeFromWsEvents();
            }
        });
    }

    isPrinterConnected(): boolean {
        return this.devicesSubject.value.some(
            (d) => d.providerType === 'printer' && d.isConnected,
        );
    }

    isScannerConnected(): boolean {
        return this.devicesSubject.value.some(
            (d) => d.providerType === 'scanner' && d.isConnected,
        );
    }

    reset(): void {
        this.unsubscribeFromWsEvents();
        this.devicesSubject.next([]);
        this.subscribed = false;
    }

    private subscribeToWsEvents(): void {
        if (this.wsSubs.length > 0) return;

        this.wsSubs.push(
            this.userWs.on<DevicesStatusCurrentPayload>(WsEvent.DevicesStatusCurrent).subscribe((data) => {
                this.devicesSubject.next(data.devices);
            }),
        );

        this.wsSubs.push(
            this.userWs.on<DeviceStatusChangedPayload>(WsEvent.DevicesPrinterStatusChanged).subscribe((data) => {
                this.updateDeviceStatus(data);
            }),
        );

        this.wsSubs.push(
            this.userWs.on<DeviceStatusChangedPayload>(WsEvent.DevicesScannerStatusChanged).subscribe((data) => {
                this.updateDeviceStatus(data);
            }),
        );
    }

    private unsubscribeFromWsEvents(): void {
        for (const sub of this.wsSubs) {
            sub.unsubscribe();
        }
        this.wsSubs = [];
    }

    private updateDeviceStatus(update: DeviceStatusChangedPayload): void {
        const currentState = this.workstationSession.currentState;
        // Only process updates for current workstation
        if (currentState.workstationId !== update.workstationId) return;

        const devices = [...this.devicesSubject.value];
        const idx = devices.findIndex((d) => d.providerType === update.providerType);
        const updated: WorkstationDeviceStatus = {
            providerType: update.providerType,
            isConnected: update.isConnected,
            deviceConnected: update.deviceConnected ?? null,
            agentVersion: update.agentVersion,
            lastSeenAt: new Date().toISOString(),
            capabilities: idx >= 0 ? devices[idx].capabilities : null,
        };
        if (idx >= 0) {
            devices[idx] = updated;
        } else {
            devices.push(updated);
        }
        this.devicesSubject.next(devices);
    }
}
