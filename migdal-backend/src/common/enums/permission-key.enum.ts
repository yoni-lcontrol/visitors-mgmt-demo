/**
 * All permission keys in the system.
 * Format: {module}.{action}
 */
export enum PermissionKey {
    // Users
    UsersCreate = 'users.create',
    UsersRead = 'users.read',
    UsersUpdate = 'users.update',
    UsersSync = 'users.sync',

    // Roles
    RolesCreate = 'roles.create',
    RolesRead = 'roles.read',
    RolesUpdate = 'roles.update',
    RolesDelete = 'roles.delete',

    // Permissions
    PermissionsRead = 'permissions.read',

    // Access Control
    AccessControlCreate = 'access-control.create',
    AccessControlRead = 'access-control.read',
    AccessControlUpdate = 'access-control.update',
    AccessControlDelete = 'access-control.delete',
    AccessControlImport = 'access-control.import',
    AccessControlSync = 'access-control.sync',

    // Visits
    VisitsCreate = 'visits.create',
    VisitsRead = 'visits.read',
    VisitsUpdate = 'visits.update',
    VisitsDelete = 'visits.delete',
    VisitsCheckInCodeSend = 'visits.check-in-code.send',
    VisitsCheckInCodeRegenerate = 'visits.check-in-code.regenerate',
    VisitsOnBehalfOnly = 'visits.on-behalf-only',
    VisitsEscortRequired = 'visits.escort.required',
    VisitsEscortRequiredSelfRequester = 'visits.escort.required.self-requester',
    VisitsScopeOwn = 'visits.scope.own',
    VisitsScopeAll = 'visits.scope.all',
    VisitsScopeTrainingCenter = 'visits.scope.training-center',
    VisitsDeleteOwnOnly = 'visits.delete.own-only',

    // Visitors
    VisitorsCreate = 'visitors.create',
    VisitorsRead = 'visitors.read',
    VisitorsUpdate = 'visitors.update',
    VisitorsDelete = 'visitors.delete',
    VisitorsExport = 'visitors.export',
    VisitorsImport = 'visitors.import',
    VisitorsScopeOwn = 'visitors.scope.own',

    // Settings
    SettingsRead = 'settings.read',
    SettingsUpdate = 'settings.update',
    SettingsPermanentEscortsRead = 'settings.permanent-escorts.read',
    SettingsPermanentEscortsManage = 'settings.permanent-escorts.manage',

    // Card Templates
    SettingsCardTemplatesRead = 'settings.card-templates.read',
    SettingsCardTemplatesCreate = 'settings.card-templates.create',
    SettingsCardTemplatesUpdate = 'settings.card-templates.update',
    SettingsCardTemplatesDelete = 'settings.card-templates.delete',

    // Audit
    AuditRead = 'audit.read',
    AuditExport = 'audit.export',

    // Devices & Printing
    VisitsPrintCard = 'visits.print-card',
    DevicesRead = 'devices.read',
    DevicesManage = 'devices.manage',
    ScannerExecute = 'scanner.execute',

    // Workstations
    WorkstationsRead = 'workstations.read',
    WorkstationsCreate = 'workstations.create',
    WorkstationsUpdate = 'workstations.update',
    WorkstationsDelete = 'workstations.delete',
    WorkstationsAssignUsers = 'workstations.assign-users',
    WorkstationsAssignRoles = 'workstations.assign-roles',
    WorkstationsEnrollAgents = 'workstations.enroll-agents',

    // Blacklist
    BlacklistRead = 'blacklist.read',
    BlacklistCreate = 'blacklist.create',
    BlacklistUpdate = 'blacklist.update',
    BlacklistDelete = 'blacklist.delete',
    BlacklistCheck = 'blacklist.check',

    // Parking
    ParkingRequest = 'parking.request',
    ParkingAutoApprove = 'parking.auto-approve',
    ParkingApprove = 'parking.approve',

    // Buildings
    BuildingsRead = 'buildings.read',
    BuildingsCreate = 'buildings.create',
    BuildingsUpdate = 'buildings.update',

    // Vehicle Models
    VehicleModelsView = 'vehicle-models.view',
    VehicleModelsCreate = 'vehicle-models.create',
    VehicleModelsUpdate = 'vehicle-models.update',
    VehicleModelsDelete = 'vehicle-models.delete',
    VehicleModelsExport = 'vehicle-models.export',
}
