-- =============================================
-- Migdal Management Platform — Seed Data
-- Run AFTER schema.sql
-- =============================================

-- =============================================
-- 1. PERMISSIONS (72 permissions)
-- =============================================
INSERT INTO [Permissions] ([id], [key], [name], [module], [action], [description], [createdAt], [updatedAt])
VALUES
  -- Users
  (NEWID(), 'users.create',  'Create Users',  'users', 'create', 'Create new user accounts',   GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'users.read',    'Read Users',    'users', 'read',   'View user details',          GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'users.update',  'Update Users',  'users', 'update', 'Edit user information',      GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'users.sync',    'Sync Users',    'users', 'sync',   'Synchronise users from AD',  GETUTCDATE(), GETUTCDATE()),

  -- Roles
  (NEWID(), 'roles.create',  'Create Roles',  'roles', 'create', 'Create new roles',           GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'roles.read',    'Read Roles',    'roles', 'read',   'View roles and permissions',  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'roles.update',  'Update Roles',  'roles', 'update', 'Edit role permissions',       GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'roles.delete',  'Delete Roles',  'roles', 'delete', 'Remove custom roles',         GETUTCDATE(), GETUTCDATE()),

  -- Permissions
  (NEWID(), 'permissions.read', 'Read Permissions', 'permissions', 'read', 'View available permissions', GETUTCDATE(), GETUTCDATE()),

  -- Access Control
  (NEWID(), 'access-control.create', 'Create Access Control', 'access-control', 'create', 'Add controllers and devices',     GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'access-control.read',   'Read Access Control',   'access-control', 'read',   'View access control devices',      GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'access-control.update', 'Update Access Control', 'access-control', 'update', 'Edit device configuration',        GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'access-control.delete', 'Delete Access Control', 'access-control', 'delete', 'Remove access control devices',    GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'access-control.import', 'Import Access Control', 'access-control', 'import', 'Import devices from external source', GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'access-control.sync',   'Sync Access Control',   'access-control', 'sync',   'Synchronise device status',        GETUTCDATE(), GETUTCDATE()),

  -- Visits
  (NEWID(), 'visits.create',                       'Create Visits',                       'visits', 'create',                       'Create visit records',                          GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.read',                         'Read Visits',                         'visits', 'read',                         'View visit information',                        GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.update',                       'Update Visits',                       'visits', 'update',                       'Edit visit records',                            GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.delete',                       'Delete Visits',                       'visits', 'delete',                       'Remove visit records',                          GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.check-in-code.send',           'Send Check-in Code',                 'visits', 'check-in-code.send',           'Send check-in code to visitor',                 GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.check-in-code.regenerate',     'Regenerate Check-in Code',            'visits', 'check-in-code.regenerate',     'Regenerate check-in code for visitor',           GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.on-behalf-only',               'On Behalf Only',                      'visits', 'on-behalf-only',               'Can only create visits on behalf of others',     GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.escort.required',              'Escort Required',                     'visits', 'escort.required',              'Escort is required for visits',                  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.escort.required.self-requester','Escort Required Self Requester',     'visits', 'escort.required.self-requester','Escort required when user is the requester',     GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.scope.own',                    'Scope Own Visits',                    'visits', 'scope.own',                    'View only own visits',                           GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.scope.all',                    'Scope All Visits',                    'visits', 'scope.all',                    'View all visits',                                GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.scope.training-center',        'Scope Training Center',               'visits', 'scope.training-center',        'View training center visits',                    GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.delete.own-only',              'Delete Own Visits Only',              'visits', 'delete.own-only',              'Delete only own visits',                         GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visits.print-card',                   'Print Visitor Card',                  'visits', 'print-card',                   'Print visitor badge card',                       GETUTCDATE(), GETUTCDATE()),

  -- Visitors
  (NEWID(), 'visitors.create',    'Create Visitors',    'visitors', 'create',    'Create visitor records',          GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitors.read',      'Read Visitors',      'visitors', 'read',      'View visitor information',        GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitors.update',    'Update Visitors',    'visitors', 'update',    'Edit visitor records',            GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitors.delete',    'Delete Visitors',    'visitors', 'delete',    'Remove visitor records',          GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitors.export',    'Export Visitors',    'visitors', 'export',    'Export visitor data',             GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitors.import',    'Import Visitors',    'visitors', 'import',    'Import visitor data',             GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitors.scope.own', 'Scope Own Visitors', 'visitors', 'scope.own', 'View only own visitors',          GETUTCDATE(), GETUTCDATE()),

  -- Settings
  (NEWID(), 'settings.read',                       'Read Settings',                  'settings', 'read',                       'View system settings',                          GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'settings.update',                     'Update Settings',                'settings', 'update',                     'Modify system settings',                        GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'settings.permanent-escorts.read',     'Read Permanent Escorts',         'settings', 'permanent-escorts.read',     'View permanent escorts',                        GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'settings.permanent-escorts.manage',   'Manage Permanent Escorts',       'settings', 'permanent-escorts.manage',   'Manage permanent escorts',                      GETUTCDATE(), GETUTCDATE()),

  -- Card Templates
  (NEWID(), 'settings.card-templates.read',   'Read Card Templates',           'settings', 'card-templates.read',   'View card templates',                           GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'settings.card-templates.create', 'Create Card Templates',         'settings', 'card-templates.create', 'Create card templates',                         GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'settings.card-templates.update', 'Update Card Templates',         'settings', 'card-templates.update', 'Edit card templates',                           GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'settings.card-templates.delete', 'Delete Card Templates',         'settings', 'card-templates.delete', 'Remove card templates',                         GETUTCDATE(), GETUTCDATE()),

  -- Audit
  (NEWID(), 'audit.read',   'Read Audit Log',   'audit', 'read',   'View audit trail',         GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'audit.export', 'Export Audit Log',  'audit', 'export', 'Export audit log data',    GETUTCDATE(), GETUTCDATE()),

  -- Devices & Printing
  (NEWID(), 'devices.read',      'Read Devices',      'devices', 'read',      'View device status',              GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'devices.manage',    'Manage Devices',    'devices', 'manage',    'Manage device agents',            GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'scanner.execute',   'Execute Scanner',   'scanner', 'execute',   'Execute scanner operations',      GETUTCDATE(), GETUTCDATE()),

  -- Workstations
  (NEWID(), 'workstations.read',           'Read Workstations',           'workstations', 'read',           'View workstations',                  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'workstations.create',         'Create Workstations',         'workstations', 'create',         'Create workstations',                GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'workstations.update',         'Update Workstations',         'workstations', 'update',         'Edit workstations',                  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'workstations.delete',         'Delete Workstations',         'workstations', 'delete',         'Remove workstations',                GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'workstations.assign-users',   'Assign Users to Workstations','workstations', 'assign-users',   'Assign users to workstations',       GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'workstations.assign-roles',   'Assign Roles to Workstations','workstations', 'assign-roles',   'Assign roles to workstations',       GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'workstations.enroll-agents',  'Enroll Workstation Agents',   'workstations', 'enroll-agents',  'Enroll agents on workstations',      GETUTCDATE(), GETUTCDATE()),

  -- Blacklist
  (NEWID(), 'blacklist.read',   'Read Blacklist',   'blacklist', 'read',   'View blacklist entries',    GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'blacklist.create', 'Create Blacklist', 'blacklist', 'create', 'Add blacklist entries',     GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'blacklist.update', 'Update Blacklist', 'blacklist', 'update', 'Edit blacklist entries',    GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'blacklist.delete', 'Delete Blacklist', 'blacklist', 'delete', 'Remove blacklist entries',  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'blacklist.check',  'Check Blacklist',  'blacklist', 'check',  'Check against blacklist',   GETUTCDATE(), GETUTCDATE()),

  -- Parking
  (NEWID(), 'parking.request',      'Request Parking',      'parking', 'request',      'Request parking space',          GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'parking.auto-approve', 'Auto Approve Parking', 'parking', 'auto-approve', 'Auto-approve parking requests',  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'parking.approve',      'Approve Parking',      'parking', 'approve',      'Approve parking requests',       GETUTCDATE(), GETUTCDATE()),

  -- Buildings
  (NEWID(), 'buildings.read',   'Read Buildings',   'buildings', 'read',   'View buildings',    GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'buildings.create', 'Create Buildings', 'buildings', 'create', 'Create buildings',  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'buildings.update', 'Update Buildings', 'buildings', 'update', 'Edit buildings',    GETUTCDATE(), GETUTCDATE()),

  -- Vehicle Models
  (NEWID(), 'vehicle-models.view',   'View Vehicle Models',   'vehicle-models', 'view',   'View vehicle models',    GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'vehicle-models.create', 'Create Vehicle Models', 'vehicle-models', 'create', 'Create vehicle models',  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'vehicle-models.update', 'Update Vehicle Models', 'vehicle-models', 'update', 'Edit vehicle models',    GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'vehicle-models.delete', 'Delete Vehicle Models', 'vehicle-models', 'delete', 'Remove vehicle models',  GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'vehicle-models.export', 'Export Vehicle Models', 'vehicle-models', 'export', 'Export vehicle models',  GETUTCDATE(), GETUTCDATE());

GO

-- =============================================
-- 2. ROLES (3 system roles)
-- =============================================
DECLARE @AdminRoleId  UNIQUEIDENTIFIER = NEWID();
DECLARE @OperatorRoleId UNIQUEIDENTIFIER = NEWID();
DECLARE @ViewerRoleId UNIQUEIDENTIFIER = NEWID();

INSERT INTO [Roles] ([id], [name], [description], [isSystem], [createdAt], [updatedAt])
VALUES
  (@AdminRoleId,    'Admin',    'Full system administrator with all permissions',   1, GETUTCDATE(), GETUTCDATE()),
  (@OperatorRoleId, 'Operator', 'Operational user with create / read / update access', 1, GETUTCDATE(), GETUTCDATE()),
  (@ViewerRoleId,   'Viewer',   'Read-only access to all modules',                  1, GETUTCDATE(), GETUTCDATE());

GO

-- =============================================
-- 3. ROLE ↔ PERMISSION ASSIGNMENTS
-- =============================================

-- Admin → ALL permissions
INSERT INTO [RolePermissions] ([roleId], [permissionId])
SELECT r.[id], p.[id]
FROM [Roles] r
CROSS JOIN [Permissions] p
WHERE r.[name] = 'Admin';

-- Operator → read + create + update (no delete, no audit.export, no import)
INSERT INTO [RolePermissions] ([roleId], [permissionId])
SELECT r.[id], p.[id]
FROM [Roles] r
CROSS JOIN [Permissions] p
WHERE r.[name] = 'Operator'
  AND p.[action] IN ('create', 'read', 'update', 'sync');

-- Viewer → read-only
INSERT INTO [RolePermissions] ([roleId], [permissionId])
SELECT r.[id], p.[id]
FROM [Roles] r
CROSS JOIN [Permissions] p
WHERE r.[name] = 'Viewer'
  AND p.[action] = 'read';

GO

-- =============================================
-- 4. DEFAULT ADMIN USER
-- Password: Admin@123  (bcrypt hash — $2b$12$...)
-- Replace the hash below with a valid bcrypt hash of
-- your chosen password before running in production.
-- =============================================
DECLARE @AdminUserId UNIQUEIDENTIFIER = NEWID();

INSERT INTO [Users] ([id], [username], [passwordHash], [firstName], [lastName], [createdAt], [updatedAt])
VALUES (
    @AdminUserId,
    'admin',
    '$2b$12$placeholder.hash.replace.before.production....',
    'System',
    'Admin',
    GETUTCDATE(),
    GETUTCDATE()
);

-- Assign Admin role to default admin user
UPDATE [Users]
SET [roleId] = (SELECT [id] FROM [Roles] WHERE [name] = 'Admin')
WHERE [id] = @AdminUserId;

GO

-- =============================================
-- 5. DEFAULT SETTINGS
-- =============================================
INSERT INTO [Settings] ([id], [key], [value], [type], [group], [label], [description], [isPublic], [createdAt], [updatedAt])
VALUES
  (NEWID(), 'app.name',               'Migdal Visitors',       'string',  'general',  'Application Name',              'Display name of the platform',  1, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'app.timezone',           'Asia/Jerusalem',        'string',  'general',  'Default Timezone',              'System default timezone',       1, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'auth.sessionTimeout',    '900',                   'number',  'auth',     'Session Timeout (seconds)',     'JWT access token lifetime',     0, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'auth.maxRefreshDays',    '7',                     'number',  'auth',     'Refresh Token Lifetime (days)', 'Refresh token validity',        0, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitors.requireApproval', 'true',                'boolean', 'visitors', 'Require Visitor Approval',      'Visitors need approval before check-in', 1, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitors.badgePrefix',   'VIS-',                  'string',  'visitors', 'Badge Number Prefix',           'Prefix for auto-generated badge numbers', 0, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'retention.deviceCommandLogsMonths', '3', 'number', 'retention', 'Device Command Logs Retention (Months)', 'Number of months to keep completed device command logs before automatic deletion', 0, GETUTCDATE(), GETUTCDATE());

GO

-- =============================================
-- 6. DEFAULT SMS TEMPLATES
-- =============================================
INSERT INTO [SmsTemplates] ([id], [event], [template], [recipients], [isActive], [createdAt], [updatedAt])
VALUES
  (NEWID(), 'visitor_arrived',     N'שלום {{visitor.firstName}}, הגעת לביקור ב{{visit.siteName}}. המארח שלך: {{visit.hostName}}. קוד כניסה: {{visitor.checkInCode}}', NULL, 1, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visit_created',      N'שלום {{visitor.firstName}} {{visitor.lastName}}, נקבע לך ביקור ב{{visit.siteName}} בתאריך {{visit.startTime}}. המארח: {{visit.hostName}}. מטרת הביקור: {{visit.purposeOfVisit}}', NULL, 1, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visit_updated',      N'שלום {{visitor.firstName}}, הביקור שלך ב{{visit.siteName}} עודכן. תאריך: {{visit.startTime}}. המארח: {{visit.hostName}}', NULL, 1, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitor_deleted',    N'שלום {{visitor.firstName}}, הביקור שלך ב{{visit.siteName}} בתאריך {{visit.startTime}} בוטל', NULL, 1, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'visitor_blacklisted', N'שלום, המבקר {{visitor.firstName}} {{visitor.lastName}} (ת.ז. {{visitor.personId}}) נחסם מכניסה ל{{visit.siteName}}', NULL, 1, GETUTCDATE(), GETUTCDATE()),
  (NEWID(), 'check_in_code_sent', N'שלום {{visitor.firstName}}, קוד הכניסה שלך לביקור ב{{visit.siteName}} הוא: {{visitor.checkInCode}}. המארח: {{visit.hostName}}', NULL, 1, GETUTCDATE(), GETUTCDATE());

GO
