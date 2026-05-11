import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';

/** User -> Backend: bind session to workstation by ID */
export interface WorkstationBindPayload {
    workstationId: string;
}

/** Backend -> User: bind success response */
export interface WorkstationBindSuccessPayload {
    workstationId: string;
    code: string;
    displayName: string;
    devices: WorkstationDeviceStatus[];
}

/** Backend -> User: bind failed response */
export interface WorkstationBindFailedPayload {
    reason: string;
}

/** Device status for workstation */
export interface WorkstationDeviceStatus {
    providerType: IntegrationProvider;
    isConnected: boolean;
    deviceConnected: boolean | null;
    agentVersion: string | null;
    lastSeenAt: string | null;
    capabilities: string[] | null;
}

/** Backend -> User: print queued */
export interface VisitorPrintQueuedPayload {
    correlationId: string;
    visitId: string;
    visitorId: string;
}

/** Backend -> User: print started */
export interface VisitorPrintStartedPayload {
    correlationId: string;
}

/** Backend -> User: print completed */
export interface VisitorPrintCompletedPayload {
    correlationId: string;
    visitId: string;
    visitorId: string;
}

/** Backend -> User: print failed */
export interface VisitorPrintFailedPayload {
    correlationId: string;
    visitId: string;
    visitorId: string;
    reason: string;
}

/** User -> Backend: scanner action request */
export interface ScannerActionRequestPayload {
    actionType: string;
    metadata?: Record<string, unknown>;
}

/** Backend -> User: scanner action completed */
export interface ScannerActionCompletedPayload {
    correlationId: string;
    result: Record<string, unknown>;
}

/** Backend -> User: scanner action failed */
export interface ScannerActionFailedPayload {
    correlationId: string;
    reason: string;
}

/** Backend -> User: device status changed */
export interface DeviceStatusChangedPayload {
    workstationId: string;
    providerType: IntegrationProvider;
    isConnected: boolean;
    deviceConnected: boolean | null;
    agentVersion: string | null;
}

/** Agent -> Backend: agent enroll (first-time setup via enrollment token) */
export interface AgentEnrollPayload {
    enrollmentToken: string;
    providerType: IntegrationProvider;
    machineId: string;
    hostname: string;
    version: string;
    capabilities: string[];
    metadata?: Record<string, unknown>;
}

/** Backend -> Agent: enrollment success with generated HMAC credentials */
export interface AgentEnrolledPayload {
    clientId: string;
    clientSecret: string;
    workstationId: string;
}

/** Agent -> Backend: agent register */
export interface AgentRegisterPayload {
    clientId: string;
    timestamp: number;
    signature: string;
    providerType: IntegrationProvider;
    machineId: string;
    hostname: string;
    version: string;
    capabilities: string[];
    deviceConnected?: boolean;
    metadata?: Record<string, unknown>;
}

/** Backend -> Agent: registered confirmation */
export interface AgentRegisteredPayload {
    agentId: string;
    workstationId: string;
}

/** Agent -> Backend: heartbeat */
export interface AgentHeartbeatPayload {
    clientId: string;
    timestamp: number;
}

/** Agent -> Backend: command acknowledgment */
export interface AgentCommandAckPayload {
    correlationId: string;
}

/** Agent -> Backend: command result */
export interface AgentCommandResultPayload {
    correlationId: string;
    success: boolean;
    result?: Record<string, unknown>;
    errorMessage?: string;
}

/** Backend -> Agent: execute print command */
export interface AgentExecutePrintPayload {
    correlationId: string;
    visitId: string;
    visitorId: string;
    cardTemplateId?: string;
    printData: Record<string, unknown>;
    printOptions?: Record<string, unknown>;
}

/** Backend -> Agent: execute scan command */
export interface AgentExecuteScanPayload {
    correlationId: string;
    actionType: string;
    metadata?: Record<string, unknown>;
}

/** Agent -> Backend: device hardware status update */
export interface AgentStatusUpdatePayload {
    status: string;
    deviceConnected?: boolean;
    [key: string]: unknown;
}

/** Kiosk -> Backend: register kiosk on a workstation */
export interface KioskRegisterPayload {
    kioskId: string;
    workstationCode: string;
}

/** Backend -> Kiosk: registration confirmed */
export interface KioskRegisteredPayload {
    kioskId: string;
    workstationCode: string;
}

/** Kiosk -> Backend: request a scan on the workstation's scanner */
export interface KioskRequestScanPayload {
    kioskId: string;
}

/** Backend -> Kiosk: scan result forwarded from scanner agent */
export interface KioskScanResultPayload {
    correlationId: string;
    success: boolean;
    result?: Record<string, unknown>;
    errorMessage?: string;
}
