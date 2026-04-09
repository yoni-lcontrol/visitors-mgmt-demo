export interface WorkstationBindPayload {
    workstationId: string;
}

export interface WorkstationBindSuccessPayload {
    workstationId: string;
    code: string;
    displayName: string | null;
    devices: WorkstationDeviceStatus[];
}

export interface WorkstationBindFailedPayload {
    reason: string;
}

export interface WorkstationDeviceStatus {
    providerType: 'printer' | 'scanner';
    isConnected: boolean;
    deviceConnected: boolean | null;
    agentVersion: string | null;
    lastSeenAt: string | null;
    capabilities: string[] | null;
}

export interface VisitorPrintQueuedPayload {
    correlationId: string;
    visitId: string;
    visitorId: string;
}

export interface VisitorPrintStartedPayload {
    correlationId: string;
}

export interface VisitorPrintCompletedPayload {
    correlationId: string;
    visitId: string;
    visitorId: string;
}

export interface VisitorPrintFailedPayload {
    correlationId: string;
    visitId: string;
    visitorId: string;
    reason: string;
}

export interface ScannerActionRequestPayload {
    actionType: string;
    metadata?: Record<string, unknown>;
}

export interface ScannerActionCompletedPayload {
    correlationId: string;
    result: Record<string, unknown>;
}

export interface ScannerActionFailedPayload {
    correlationId: string;
    reason: string;
}

export interface DeviceStatusChangedPayload {
    workstationId: string;
    providerType: 'printer' | 'scanner';
    isConnected: boolean;
    deviceConnected: boolean | null;
    agentVersion: string | null;
}

export interface DevicesStatusCurrentPayload {
    devices: WorkstationDeviceStatus[];
}
