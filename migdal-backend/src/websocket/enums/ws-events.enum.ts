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
    AccessControlControllerStatusChanged = 'access-control:controller:status-changed',
    AccessControlDoorCreated = 'access-control:door:created',
    AccessControlDoorUpdated = 'access-control:door:updated',
    AccessControlDoorDeleted = 'access-control:door:deleted',
    AccessControlExtensionCreated = 'access-control:extension:created',
    AccessControlExtensionUpdated = 'access-control:extension:updated',
    AccessControlExtensionDeleted = 'access-control:extension:deleted',
    AccessControlImportCompleted = 'access-control:import:completed',
    AccessControlImportFailed = 'access-control:import:failed',
    AccessControlControllersImportProgress = 'access-control:controllers:import-progress',
    AccessControlControllersImportCompleted = 'access-control:controllers:import-completed',
    AccessControlControllersImportFailed = 'access-control:controllers:import-failed',
    AccessControlAccessLevelsImportProgress = 'access-control:access-levels:import-progress',
    AccessControlAccessLevelsImportCompleted = 'access-control:access-levels:import-completed',
    AccessControlAccessLevelsImportFailed = 'access-control:access-levels:import-failed',

    // AD Sync
    AdSyncProgress = 'users:ad-sync:progress',
    AdSyncCompleted = 'users:ad-sync:completed',
    AdSyncFailed = 'users:ad-sync:failed',

    // Visitors
    VisitorsVisitorCreated = 'visitors:visitor:created',
    VisitorsVisitorUpdated = 'visitors:visitor:updated',
    VisitorsVisitorCheckedIn = 'visitors:visitor:checked-in',
    VisitorsVisitorCheckedOut = 'visitors:visitor:checked-out',
    VisitorsVisitorDeleted = 'visitors:visitor:deleted',

    // Settings
    SettingsSettingUpdated = 'settings:setting:updated',

    // System
    SystemNotification = 'system:notification',
    SystemMaintenance = 'system:maintenance',

    // Integrations
    IntegrationsAccessControlEventReceived = 'integrations:access-control:event-received',
    IntegrationsScannerEventReceived = 'integrations:scanner:event-received',
    IntegrationsPrinterEventReceived = 'integrations:printer:event-received',
    IntegrationsAmadeusEventReceived = 'integrations:amadeus:event-received',

    // Workstation binding (User -> Backend)
    WorkstationBindCurrentSession = 'workstation:bind-current-session',
    // Workstation binding (Backend -> User)
    WorkstationBindSuccess = 'workstation:bind-success',
    WorkstationBindFailed = 'workstation:bind-failed',

    // Device status (User -> Backend)
    DevicesStatusGetCurrent = 'devices:status:get-current',
    // Device status (Backend -> User)
    DevicesStatusCurrent = 'devices:status:current',
    DevicesPrinterStatusChanged = 'devices:printer:status-changed',
    DevicesScannerStatusChanged = 'devices:scanner:status-changed',
    DevicesStatusChanged = 'devices:status:changed',

    // Print card (Backend -> User, request via HTTP API)
    VisitsVisitorPrintQueued = 'visits:visitor:print-queued',
    VisitsVisitorPrintStarted = 'visits:visitor:print-started',
    VisitsVisitorPrintCompleted = 'visits:visitor:print-completed',
    VisitsVisitorPrintFailed = 'visits:visitor:print-failed',

    // Scanner (User -> Backend)
    ScannerActionRequest = 'scanner:action:request',
    // Scanner (Backend -> User)
    ScannerActionCompleted = 'scanner:action:completed',
    ScannerActionFailed = 'scanner:action:failed',

    // Agent events (Agent -> Backend)
    AgentRegister = 'agent:register',
    AgentEnroll = 'agent:enroll',
    AgentHeartbeat = 'agent:heartbeat',
    AgentStatusUpdate = 'agent:status:update',
    AgentCommandAck = 'agent:command-ack',
    AgentCommandResult = 'agent:command-result',
    AgentError = 'agent:error',

    // Agent events (Backend -> Agent)
    AgentRegistered = 'agent:registered',
    AgentEnrolled = 'agent:enrolled',
    AgentExecutePrint = 'agent:execute-print',
    AgentExecuteScan = 'agent:execute-scan',
    AgentGetStatus = 'agent:get-status',
    AgentPing = 'agent:ping',
}
