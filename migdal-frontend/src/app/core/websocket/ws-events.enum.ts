export enum WsEvent {
    // Auth
    AuthForceLogout = 'auth:force-logout',
    AuthPermissionsChanged = 'auth:permissions-changed',

    // Users
    UsersUserCreated = 'users:user:created',
    UsersUserUpdated = 'users:user:updated',
    UsersUserDeleted = 'users:user:deleted',

    // Access Control
    AccessControlControllerCreated = 'access-control:controller:created',
    AccessControlControllerUpdated = 'access-control:controller:updated',
    AccessControlControllerDeleted = 'access-control:controller:deleted',
    AccessControlDoorCreated = 'access-control:door:created',
    AccessControlDoorUpdated = 'access-control:door:updated',
    AccessControlDoorDeleted = 'access-control:door:deleted',
    AccessControlImportCompleted = 'access-control:import:completed',
    AccessControlImportFailed = 'access-control:import:failed',

    // Visitors
    VisitorsVisitorCreated = 'visitors:visitor:created',
    VisitorsVisitorUpdated = 'visitors:visitor:updated',
    VisitorsVisitorCheckedIn = 'visitors:visitor:checked-in',
    VisitorsVisitorCheckedOut = 'visitors:visitor:checked-out',
    VisitsCreated = 'visits:created',
    VisitsVisitorArrived = 'visits:visitor:arrived',
    VisitsVisitorCheckedIn = 'visits:visitor:checked-in',
    VisitsVisitorCheckedOut = 'visits:visitor:checked-out',
    VisitsCheckInCodeGenerated = 'visits:check-in-code:generated',
    VisitsCheckInCodeRegenerated = 'visits:check-in-code:regenerated',
    VisitsVisitorSelfCheckedIn = 'visits:visitor:self-checked-in',

    // Settings
    SettingsSettingUpdated = 'settings:setting:updated',

    // Card Templates
    SettingsCardTemplateCreated = 'settings:card-template:created',
    SettingsCardTemplateUpdated = 'settings:card-template:updated',
    SettingsCardTemplateDeleted = 'settings:card-template:deleted',

    // Integrations
    IntegrationsAccessControlEventReceived = 'integrations:access-control:event-received',
    IntegrationsScannerEventReceived = 'integrations:scanner:event-received',
    IntegrationsPrinterEventReceived = 'integrations:printer:event-received',

    // Workstation binding
    WorkstationBindCurrentSession = 'workstation:bind-current-session',
    WorkstationBindSuccess = 'workstation:bind-success',
    WorkstationBindFailed = 'workstation:bind-failed',

    // Device status
    DevicesStatusGetCurrent = 'devices:status:get-current',
    DevicesStatusCurrent = 'devices:status:current',
    DevicesPrinterStatusChanged = 'devices:printer:status-changed',
    DevicesScannerStatusChanged = 'devices:scanner:status-changed',
    DevicesStatusChanged = 'devices:status:changed',

    // Print card (progress events, request via HTTP API)
    VisitsVisitorPrintQueued = 'visits:visitor:print-queued',
    VisitsVisitorPrintStarted = 'visits:visitor:print-started',
    VisitsVisitorPrintCompleted = 'visits:visitor:print-completed',
    VisitsVisitorPrintFailed = 'visits:visitor:print-failed',

    // Scanner
    ScannerActionRequest = 'scanner:action:request',
    ScannerActionCompleted = 'scanner:action:completed',
    ScannerActionFailed = 'scanner:action:failed',
}
