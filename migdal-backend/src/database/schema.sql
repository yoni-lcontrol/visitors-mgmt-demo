-- =============================================
-- Migdal Management Platform — Database Schema
-- Microsoft SQL Server
-- Generated: 2026-03-26
-- =============================================
-- Execution order matters due to FK dependencies.
-- Run this script on an empty database.
-- =============================================

-- =============================================
-- 1. USERS
-- =============================================
CREATE TABLE [Users] (
    [id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [username]      NVARCHAR(255)    NOT NULL,
    [passwordHash]  NVARCHAR(255)    NOT NULL,
    [firstName]     NVARCHAR(100)    NOT NULL,
    [lastName]      NVARCHAR(100)    NOT NULL,
    [lastLoginAt]   DATETIME2        NULL,
    [isActive]      BIT              NOT NULL DEFAULT 1,
    [createdBy]     UNIQUEIDENTIFIER NULL,
    [updatedBy]     UNIQUEIDENTIFIER NULL,
    [createdAt]     DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]     DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_Users]          PRIMARY KEY ([id]),
    CONSTRAINT [UQ_Users_Username] UNIQUE ([username])
);

CREATE INDEX [IX_Users_IsActive] ON [Users] ([isActive]);
CREATE INDEX [IX_Users_Username] ON [Users] ([username]);

-- =============================================
-- 2. ROLES
-- =============================================
CREATE TABLE [Roles] (
    [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [name]        NVARCHAR(100)    NOT NULL,
    [description] NVARCHAR(500)    NULL,
    [isSystem]    BIT              NOT NULL DEFAULT 0,
    [isActive]    BIT              NOT NULL DEFAULT 1,
    [createdBy]   UNIQUEIDENTIFIER NULL,
    [updatedBy]   UNIQUEIDENTIFIER NULL,
    [createdAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_Roles]      PRIMARY KEY ([id]),
    CONSTRAINT [UQ_Roles_Name] UNIQUE ([name])
);

-- =============================================
-- 3. PERMISSIONS
-- =============================================
CREATE TABLE [Permissions] (
    [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [key]         NVARCHAR(100)    NOT NULL,
    [name]        NVARCHAR(200)    NOT NULL,
    [description] NVARCHAR(500)    NULL,
    [module]      NVARCHAR(100)    NOT NULL,
    [action]      NVARCHAR(50)     NOT NULL,
    [isActive]    BIT              NOT NULL DEFAULT 1,
    [createdBy]   UNIQUEIDENTIFIER NULL,
    [updatedBy]   UNIQUEIDENTIFIER NULL,
    [createdAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_Permissions]     PRIMARY KEY ([id]),
    CONSTRAINT [UQ_Permissions_Key] UNIQUE ([key])
);

CREATE INDEX [IX_Permissions_Module] ON [Permissions] ([module]);

-- =============================================
-- 4. USER ↔ ROLE JUNCTION (Many-to-Many)
-- =============================================
CREATE TABLE [UserRoles] (
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [roleId] UNIQUEIDENTIFIER NOT NULL,

    CONSTRAINT [PK_UserRoles]         PRIMARY KEY ([userId], [roleId]),
    CONSTRAINT [FK_UserRoles_User]    FOREIGN KEY ([userId]) REFERENCES [Users]([id]) ON DELETE CASCADE,
    CONSTRAINT [FK_UserRoles_Role]    FOREIGN KEY ([roleId]) REFERENCES [Roles]([id]) ON DELETE CASCADE
);

CREATE INDEX [IX_UserRoles_UserId] ON [UserRoles] ([userId]);
CREATE INDEX [IX_UserRoles_RoleId] ON [UserRoles] ([roleId]);

-- =============================================
-- 5. ROLE ↔ PERMISSION JUNCTION (Many-to-Many)
-- =============================================
CREATE TABLE [RolePermissions] (
    [roleId]       UNIQUEIDENTIFIER NOT NULL,
    [permissionId] UNIQUEIDENTIFIER NOT NULL,

    CONSTRAINT [PK_RolePermissions]             PRIMARY KEY ([roleId], [permissionId]),
    CONSTRAINT [FK_RolePermissions_Role]        FOREIGN KEY ([roleId])       REFERENCES [Roles]([id])       ON DELETE CASCADE,
    CONSTRAINT [FK_RolePermissions_Permission]  FOREIGN KEY ([permissionId]) REFERENCES [Permissions]([id]) ON DELETE CASCADE
);

CREATE INDEX [IX_RolePermissions_RoleId]       ON [RolePermissions] ([roleId]);
CREATE INDEX [IX_RolePermissions_PermissionId] ON [RolePermissions] ([permissionId]);

-- =============================================
-- 6. REFRESH TOKENS
-- =============================================
CREATE TABLE [RefreshTokens] (
    [id]        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [userId]    UNIQUEIDENTIFIER NOT NULL,
    [tokenHash] NVARCHAR(500)    NOT NULL,
    [expiresAt] DATETIME2        NOT NULL,
    [isRevoked] BIT              NOT NULL DEFAULT 0,
    [userAgent] NVARCHAR(500)    NULL,
    [ipAddress] NVARCHAR(45)     NULL,
    [isActive]  BIT              NOT NULL DEFAULT 1,
    [createdBy] UNIQUEIDENTIFIER NULL,
    [updatedBy] UNIQUEIDENTIFIER NULL,
    [createdAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_RefreshTokens]            PRIMARY KEY ([id]),
    CONSTRAINT [UQ_RefreshTokens_TokenHash]  UNIQUE ([tokenHash]),
    CONSTRAINT [FK_RefreshTokens_User]       FOREIGN KEY ([userId]) REFERENCES [Users]([id]) ON DELETE CASCADE
);

CREATE INDEX [IX_RefreshTokens_UserId]    ON [RefreshTokens] ([userId]);
CREATE INDEX [IX_RefreshTokens_ExpiresAt] ON [RefreshTokens] ([expiresAt]) WHERE [isRevoked] = 0;

-- =============================================
-- 7. ACCESS CONTROL — CONTROLLERS
-- =============================================
CREATE TABLE [AcControllers] (
    [id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [name]         NVARCHAR(200)    NOT NULL,
    [ipAddress]    NVARCHAR(45)     NULL,
    [model]        NVARCHAR(100)    NULL,
    [serialNumber] NVARCHAR(100)    NULL,
    [status]       NVARCHAR(50)     NOT NULL DEFAULT 'offline',
    [location]     NVARCHAR(200)    NULL,
    [firmware]     NVARCHAR(50)     NULL,
    [lastSyncAt]   DATETIME2        NULL,
    [isActive]     BIT              NOT NULL DEFAULT 1,
    [createdBy]    UNIQUEIDENTIFIER NULL,
    [updatedBy]    UNIQUEIDENTIFIER NULL,
    [createdAt]    DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]    DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_AcControllers]              PRIMARY KEY ([id]),
    CONSTRAINT [UQ_AcControllers_SerialNumber] UNIQUE ([serialNumber])
);

CREATE INDEX [IX_AcControllers_Status] ON [AcControllers] ([status]);

-- =============================================
-- 8. ACCESS CONTROL — DOORS
-- =============================================
CREATE TABLE [Doors] (
    [id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [controllerId] UNIQUEIDENTIFIER NOT NULL,
    [name]         NVARCHAR(200)    NOT NULL,
    [doorNumber]   INT              NOT NULL,
    [status]       NVARCHAR(50)     NOT NULL DEFAULT 'unknown',
    [isActive]     BIT              NOT NULL DEFAULT 1,
    [createdBy]    UNIQUEIDENTIFIER NULL,
    [updatedBy]    UNIQUEIDENTIFIER NULL,
    [createdAt]    DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]    DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_Doors]            PRIMARY KEY ([id]),
    CONSTRAINT [FK_Doors_Controller] FOREIGN KEY ([controllerId]) REFERENCES [AcControllers]([id]) ON DELETE CASCADE
);

CREATE INDEX [IX_Doors_ControllerId] ON [Doors] ([controllerId]);
CREATE INDEX [IX_Doors_Status]       ON [Doors] ([status]);

-- =============================================
-- 9. ACCESS CONTROL — EXTENSIONS
-- =============================================
CREATE TABLE [Extensions] (
    [id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [controllerId]    UNIQUEIDENTIFIER NOT NULL,
    [name]            NVARCHAR(200)    NOT NULL,
    [extensionNumber] INT              NOT NULL,
    [model]           NVARCHAR(100)    NULL,
    [status]          NVARCHAR(50)     NOT NULL DEFAULT 'unknown',
    [isActive]        BIT              NOT NULL DEFAULT 1,
    [createdBy]       UNIQUEIDENTIFIER NULL,
    [updatedBy]       UNIQUEIDENTIFIER NULL,
    [createdAt]       DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]       DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_Extensions]            PRIMARY KEY ([id]),
    CONSTRAINT [FK_Extensions_Controller] FOREIGN KEY ([controllerId]) REFERENCES [AcControllers]([id]) ON DELETE CASCADE
);

CREATE INDEX [IX_Extensions_ControllerId] ON [Extensions] ([controllerId]);

-- =============================================
-- 10. ACCESS CONTROL — DOOR IOs
-- =============================================
CREATE TABLE [DoorIOs] (
    [id]       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [doorId]   UNIQUEIDENTIFIER NOT NULL,
    [name]     NVARCHAR(200)    NOT NULL,
    [ioNumber] INT              NOT NULL,
    [ioType]   NVARCHAR(50)     NOT NULL,
    [status]   NVARCHAR(50)     NOT NULL DEFAULT 'unknown',
    [isActive] BIT              NOT NULL DEFAULT 1,
    [createdBy] UNIQUEIDENTIFIER NULL,
    [updatedBy] UNIQUEIDENTIFIER NULL,
    [createdAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_DoorIOs]      PRIMARY KEY ([id]),
    CONSTRAINT [FK_DoorIOs_Door] FOREIGN KEY ([doorId]) REFERENCES [Doors]([id]) ON DELETE CASCADE
);

CREATE INDEX [IX_DoorIOs_DoorId] ON [DoorIOs] ([doorId]);

-- =============================================
-- 11. ACCESS CONTROL — EXTENSION IOs
-- =============================================
CREATE TABLE [ExtensionIOs] (
    [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [extensionId] UNIQUEIDENTIFIER NOT NULL,
    [name]        NVARCHAR(200)    NOT NULL,
    [ioNumber]    INT              NOT NULL,
    [ioType]      NVARCHAR(50)     NOT NULL,
    [status]      NVARCHAR(50)     NOT NULL DEFAULT 'unknown',
    [isActive]    BIT              NOT NULL DEFAULT 1,
    [createdBy]   UNIQUEIDENTIFIER NULL,
    [updatedBy]   UNIQUEIDENTIFIER NULL,
    [createdAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_ExtensionIOs]           PRIMARY KEY ([id]),
    CONSTRAINT [FK_ExtensionIOs_Extension] FOREIGN KEY ([extensionId]) REFERENCES [Extensions]([id]) ON DELETE CASCADE
);

CREATE INDEX [IX_ExtensionIOs_ExtensionId] ON [ExtensionIOs] ([extensionId]);

-- =============================================
-- 12. VISITORS
-- =============================================
CREATE TABLE [Visitors] (
    [id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [firstName]      NVARCHAR(100)    NOT NULL,
    [lastName]       NVARCHAR(100)    NOT NULL,
    [email]          NVARCHAR(255)    NULL,
    [phone]          NVARCHAR(50)     NOT NULL,
    [company]        NVARCHAR(200)    NULL,
    [personId]       NVARCHAR(50)     NOT NULL,
    [carNumber]      NVARCHAR(50)     NULL,
    [vehicleType]    NVARCHAR(20)     NULL,
    [isActive]       BIT              NOT NULL DEFAULT 1,
    [createdBy]      UNIQUEIDENTIFIER NULL,
    [updatedBy]      UNIQUEIDENTIFIER NULL,
    [createdAt]      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_Visitors]          PRIMARY KEY ([id])
);

-- =============================================
-- 12b. BLACKLIST
-- =============================================
CREATE TABLE [Blacklist] (
    [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [firstName]   NVARCHAR(100)    NOT NULL,
    [lastName]    NVARCHAR(100)    NOT NULL,
    [idNumber]    NVARCHAR(50)     NULL,
    [reason]      NVARCHAR(500)    NOT NULL,
    [blockedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [expiresAt]   DATETIME2        NULL,
    [notes]       NVARCHAR(1000)   NULL,
    [isActive]    BIT              NOT NULL DEFAULT 1,
    [createdBy]   UNIQUEIDENTIFIER NULL,
    [updatedBy]   UNIQUEIDENTIFIER NULL,
    [createdAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_Blacklist] PRIMARY KEY ([id])
);

CREATE INDEX [IX_Blacklist_IdNumber]  ON [Blacklist] ([idNumber]);
CREATE INDEX [IX_Blacklist_IsActive]  ON [Blacklist] ([isActive]);

-- =============================================
-- 13. SETTINGS
-- =============================================
CREATE TABLE [Settings] (
    [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [key]         NVARCHAR(200)    NOT NULL,
    [value]       NVARCHAR(MAX)    NOT NULL,
    [type]        NVARCHAR(50)     NOT NULL DEFAULT 'string',
    [group]       NVARCHAR(100)    NOT NULL,
    [label]       NVARCHAR(200)    NOT NULL,
    [description] NVARCHAR(500)    NULL,
    [isPublic]    BIT              NOT NULL DEFAULT 0,
    [isActive]    BIT              NOT NULL DEFAULT 1,
    [createdBy]   UNIQUEIDENTIFIER NULL,
    [updatedBy]   UNIQUEIDENTIFIER NULL,
    [createdAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    [updatedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_Settings]     PRIMARY KEY ([id]),
    CONSTRAINT [UQ_Settings_Key] UNIQUE ([key])
);

CREATE INDEX [IX_Settings_Group] ON [Settings] ([group]);

-- =============================================
-- 14. AUDIT LOGS
-- =============================================
CREATE TABLE [AuditLogs] (
    [id]        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [userId]    UNIQUEIDENTIFIER NULL,
    [action]    NVARCHAR(100)    NOT NULL,
    [entity]    NVARCHAR(100)    NOT NULL,
    [entityId]  UNIQUEIDENTIFIER NULL,
    [oldValue]  NVARCHAR(MAX)    NULL,
    [newValue]  NVARCHAR(MAX)    NULL,
    [ipAddress] NVARCHAR(45)     NULL,
    [userAgent] NVARCHAR(500)    NULL,
    [createdAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT [PK_AuditLogs]      PRIMARY KEY ([id]),
    CONSTRAINT [FK_AuditLogs_User] FOREIGN KEY ([userId]) REFERENCES [Users]([id]) ON DELETE SET NULL
);

CREATE INDEX [IX_AuditLogs_UserId]    ON [AuditLogs] ([userId]);
CREATE INDEX [IX_AuditLogs_Entity]    ON [AuditLogs] ([entity], [entityId]);
CREATE INDEX [IX_AuditLogs_CreatedAt] ON [AuditLogs] ([createdAt]);
CREATE INDEX [IX_AuditLogs_Action]    ON [AuditLogs] ([action]);

GO
