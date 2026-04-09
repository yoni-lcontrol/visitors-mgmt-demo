import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
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

    constructor(
        private userWs: UserWebSocketService,
        private workstationSession: WorkstationSessionService,
    ) { }

    initListeners(): void {
        if (this.subscribed) return;
        this.subscribed = true;

        // Listen for full status updates
        this.userWs.on<DevicesStatusCurrentPayload>(WsEvent.DevicesStatusCurrent).subscribe((data) => {
            this.devicesSubject.next(data.devices);
        });

        // Listen for printer status changes
        this.userWs.on<DeviceStatusChangedPayload>(WsEvent.DevicesPrinterStatusChanged).subscribe((data) => {
            this.updateDeviceStatus(data);
        });

        // Listen for scanner status changes
        this.userWs.on<DeviceStatusChangedPayload>(WsEvent.DevicesScannerStatusChanged).subscribe((data) => {
            this.updateDeviceStatus(data);
        });

        // Sync with workstation state
        this.workstationSession.state$.subscribe((state) => {
            if (state.bound) {
                this.devicesSubject.next(state.devices);
            } else {
                this.devicesSubject.next([]);
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
        this.devicesSubject.next([]);
        this.subscribed = false;
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
