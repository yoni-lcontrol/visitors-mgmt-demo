export interface User {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    idNumber: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    roles: Role[];
    createdAt: string;
    updatedAt: string;
}

export interface Role {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    permissions: Permission[];
    createdAt: string;
}

export interface Permission {
    id: string;
    key: string;
    name: string;
    description: string | null;
    module: string;
    action: string;
}

export interface AcController {
    id: string;
    type: number;
    model: string | null;
    name: string;
    ip: string | null;
    port: number;
    isActive: boolean;
    externalId: string | null;
    doors: Door[];
    extensions: Extension[];
    createdAt: string;
}

export interface Door {
    id: string;
    controllerId: string;
    doorsIndex: number;
    name: string;
    entryType: number;
    externalId: string | null;
    isActive: boolean;
    stationId?: string;
    doorIos: DoorIo[];
}

export interface DoorIo {
    id: string;
    doorId: string;
    type: number;
    name: string;
    ioIndex: number;
    ioState: number;
    isActive: boolean;
    externalId: string | null;
}

export interface Extension {
    id: string;
    controllerId: string;
    type: number;
    name: string;
    extensionIndex: number;
    isActive: boolean;
    externalId: string | null;
    extensionIos: ExtensionIo[];
}

export interface ExtensionIo {
    id: string;
    extensionId: string;
    type: number;
    name: string;
    ioIndex: number;
    ioState: number;
    isActive: boolean;
    externalId: string | null;
}

export interface Visitor {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    personId: string;
    carNumber: string | null;
    vehicleType: string | null;
    createdAt: string;
}

export interface Setting {
    id: string;
    key: string;
    value: string;
    type: string;
    group: string;
    label: string;
    description: string | null;
    isPublic: boolean;
}

export { PaginatedResult } from './paginated-result.model';

export interface AccessLevel {
    id: string;
    name: string;
    active: boolean;
    visitorAccess: boolean;
}

export interface BlacklistEntry {
    id: string;
    blacklistType: 'person' | 'vehicle';
    firstName: string | null;
    lastName: string | null;
    idNumber: string | null;
    phoneNumber: string | null;
    carNumber: string | null;
    vehicleType: string;
    reason: string;
    isPermanent: boolean;
    startDate: string | null;
    endDate: string | null;
    blockedAt: string;
    notes: string | null;
    notifyUsers: User[];
    createdBy: string | null;
    createdByUser: { firstName: string; lastName: string } | null;
    createdAt: string;
}

export interface NotificationSetting {
    id: string;
    targetGroup: string;
    event: string;
    channel: string;
    enabled: boolean;
}

export interface SmsTemplate {
    id: string;
    event: string;
    targetGroup: string;
    template: string;
    recipients: string | null;
}

export interface AdConfiguration {
    id: string;
    name: string;
    domain: string;
    ldapUrl: string;
    baseDn: string | null;
    username: string;
    password: string;
    port: number;
    useSsl: boolean;
    description: string | null;
    createdAt: string;
}

// ── Visits Architecture ──

export enum VisitorAccessEventType {
    Arrived = 1,
    CheckedIn = 2,
    CheckedOut = 3,
}

export enum VisitorStatus {
    Pending = 0,
    Arrived = 1,
    CheckedIn = 2,
    CheckedOut = 3,
}

export enum VehicleType {
    Private = 'private',
    Company = 'company',
    Taxi = 'taxi',
    Motorcycle = 'motorcycle',
    Truck = 'truck',
    Other = 'other',
}

export interface Visit {
    id: string;
    siteId: string | null;
    buildingId: string | null;
    building?: { id: string; name: string } | null;
    floor: number | null;
    title: string;
    purposeOfVisit: string | null;
    plannedStartTimeUtc: string;
    plannedEndTimeUtc: string | null;
    createdByUserId: string | null;
    visitRequesterUserId?: string | null;
    visitRequester?: {
        firstName: string;
        lastName: string;
        phone: string;
        email: string;
    } | null;
    statusSummary?: VisitStatusSummary;
    createdAt: string;
    updatedAt: string;
}

export interface VisitStatusSummary {
    total: number;
    pending: number;
    arrived: number;
    checkedIn: number;
    checkedOut: number;
}

export interface VisitVisitor {
    id: string;
    visitId: string;
    visitorId: string;
    accessLevelId: string | null;
    accessLevel: { id: string; name: string } | null;
    notes: string | null;
    visitor: {
        id: string;
        firstName: string;
        lastName: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        personId: string;
        carNumber: string | null;
        vehicleType: string | null;
    } | null;
    parkingRequest: { status: string } | null;
    status: {
        currentStatus: number;
        arrivedAtUtc: string | null;
        checkedInAtUtc: string | null;
        checkedOutAtUtc: string | null;
        lastEventTimeUtc: string | null;
    } | null;
    createdAt: string;
}

export interface VisitEscort {
    id: string;
    visitId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    createdAt: string;
}

export interface VisitorAccessLogEntry {
    logId: number;
    visitVisitorId: string;
    visitId: string;
    visitorId: string;
    siteId: string | null;
    eventType: number;
    eventTimeUtc: string;
    deviceId: string | null;
    gateId: string | null;
    readerId: string | null;
    source: string | null;
    createdByUserId: string | null;
    notes: string | null;
    createdAt: string;
}



// ── Inline form types (used in visit create/edit dialogs) ──

export interface InlineVisitor {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    personId: string;
    hasVehicle: boolean;
    carNumber: string;
    vehicleType: string;
    accessLevelId: string;
    requestParking: boolean;
}

export interface InlineEscort {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
}

// ── Audit Logs ──

export interface AuditLog {
    id: string;
    userId: string | null;
    module: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    description: string | null;
    performedByEmail: string | null;
    oldValue: string | null;
    newValue: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: string | null;
    createdAt: string;
    user: {
        id: string;
        firstName: string;
        lastName: string;
        username: string;
    } | null;
}

// ── Workstations ──

export interface WorkstationDevice {
    providerType: string;
    isConnected: boolean;
    deviceConnected: boolean | null;
    agentVersion: string | null;
}

export interface WorkstationListItem {
    id: string;
    code: string;
    displayName: string;
    description: string | null;
    siteId: string | null;
    machineId: string | null;
    hostname: string | null;
    isActive: boolean;
    defaultCardTemplateId: string | null;
    defaultCardTemplateName: string | null;
    devices: WorkstationDevice[];
    assignedUsers: number;
    assignedRoles: number;
}

export interface WorkstationDetail {
    workstation: {
        id: string;
        code: string;
        displayName: string;
        description: string | null;
        siteId: string | null;
        machineId: string | null;
        hostname: string | null;
        isActive: boolean;
        defaultCardTemplateId: string | null;
    };
    assignedUserIds: string[];
    assignedRoleIds: string[];
    agents: WorkstationAgent[];
}

export interface WorkstationAgent {
    id: string;
    providerType: string;
    clientId: string;
    isConnected: boolean;
    version: string | null;
}

export interface AccessibleWorkstation {
    id: string;
    code: string;
    displayName: string;
    machineId: string | null;
    hostname: string | null;
    devices: WorkstationDevice[];
}

export interface CreateEnrollmentTokenResponse {
    token: string;
    expiresAt: string;
}
