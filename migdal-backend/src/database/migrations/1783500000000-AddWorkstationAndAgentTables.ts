import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkstationAndAgentTables1783500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── Workstations ──
        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Workstations')
            CREATE TABLE [dbo].[Workstations] (
                [id]                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [code]                  NVARCHAR(100)    NOT NULL,
                [displayName]           NVARCHAR(255)    NOT NULL,
                [description]           NVARCHAR(500)    NULL,
                [machineId]             NVARCHAR(255)    NULL,
                [hostname]              NVARCHAR(255)    NULL,
                [siteId]                NVARCHAR(255)    NULL,
                [metadataJson]          NVARCHAR(MAX)    NULL,
                [defaultCardTemplateId] UNIQUEIDENTIFIER NULL,
                [createdAt]             DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]             DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]             UNIQUEIDENTIFIER NULL,
                [updatedBy]             UNIQUEIDENTIFIER NULL,
                [isActive]              BIT              NOT NULL DEFAULT 1,
                CONSTRAINT [PK_Workstations] PRIMARY KEY ([id])
            )
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Workstations_Code')
            CREATE UNIQUE INDEX [IX_Workstations_Code] ON [dbo].[Workstations] ([code])
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Workstations_MachineId')
            CREATE UNIQUE INDEX [IX_Workstations_MachineId] ON [dbo].[Workstations] ([machineId]) WHERE [machineId] IS NOT NULL
        `);

        // ── WorkstationUsers ──
        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkstationUsers')
            CREATE TABLE [dbo].[WorkstationUsers] (
                [id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [workstationId] UNIQUEIDENTIFIER NOT NULL,
                [userId]        UNIQUEIDENTIFIER NOT NULL,
                [createdAt]     DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]     DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]     UNIQUEIDENTIFIER NULL,
                [updatedBy]     UNIQUEIDENTIFIER NULL,
                [isActive]      BIT              NOT NULL DEFAULT 1,
                CONSTRAINT [PK_WorkstationUsers] PRIMARY KEY ([id]),
                CONSTRAINT [FK_WorkstationUsers_Workstation] FOREIGN KEY ([workstationId]) REFERENCES [dbo].[Workstations]([id])
            )
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkstationUsers_Workstation_User')
            CREATE UNIQUE INDEX [IX_WorkstationUsers_Workstation_User] ON [dbo].[WorkstationUsers] ([workstationId], [userId])
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkstationUsers_UserId')
            CREATE INDEX [IX_WorkstationUsers_UserId] ON [dbo].[WorkstationUsers] ([userId])
        `);

        // ── WorkstationRoles ──
        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkstationRoles')
            CREATE TABLE [dbo].[WorkstationRoles] (
                [id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [workstationId] UNIQUEIDENTIFIER NOT NULL,
                [roleId]        UNIQUEIDENTIFIER NOT NULL,
                [createdAt]     DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]     DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]     UNIQUEIDENTIFIER NULL,
                [updatedBy]     UNIQUEIDENTIFIER NULL,
                [isActive]      BIT              NOT NULL DEFAULT 1,
                CONSTRAINT [PK_WorkstationRoles] PRIMARY KEY ([id]),
                CONSTRAINT [FK_WorkstationRoles_Workstation] FOREIGN KEY ([workstationId]) REFERENCES [dbo].[Workstations]([id])
            )
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkstationRoles_Workstation_Role')
            CREATE UNIQUE INDEX [IX_WorkstationRoles_Workstation_Role] ON [dbo].[WorkstationRoles] ([workstationId], [roleId])
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkstationRoles_RoleId')
            CREATE INDEX [IX_WorkstationRoles_RoleId] ON [dbo].[WorkstationRoles] ([roleId])
        `);

        // ── WorkstationEnrollmentTokens ──
        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkstationEnrollmentTokens')
            CREATE TABLE [dbo].[WorkstationEnrollmentTokens] (
                [id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [workstationId]  UNIQUEIDENTIFIER NOT NULL,
                [tokenHash]      NVARCHAR(255)    NOT NULL,
                [providerType]   NVARCHAR(50)     NOT NULL,
                [expiresAt]      DATETIME2        NOT NULL,
                [isUsed]         BIT              NOT NULL DEFAULT 0,
                [usedAt]         DATETIME2        NULL,
                [usedByAgentId]  UNIQUEIDENTIFIER NULL,
                [createdAt]      DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]      DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]      UNIQUEIDENTIFIER NULL,
                [updatedBy]      UNIQUEIDENTIFIER NULL,
                [isActive]       BIT              NOT NULL DEFAULT 1,
                CONSTRAINT [PK_WorkstationEnrollmentTokens] PRIMARY KEY ([id]),
                CONSTRAINT [FK_WorkstationEnrollmentTokens_Workstation] FOREIGN KEY ([workstationId]) REFERENCES [dbo].[Workstations]([id])
            )
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkstationEnrollmentTokens_TokenHash')
            CREATE UNIQUE INDEX [IX_WorkstationEnrollmentTokens_TokenHash] ON [dbo].[WorkstationEnrollmentTokens] ([tokenHash])
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WorkstationEnrollmentTokens_Workstation')
            CREATE INDEX [IX_WorkstationEnrollmentTokens_Workstation] ON [dbo].[WorkstationEnrollmentTokens] ([workstationId])
        `);

        // ── DeviceAgents ──
        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceAgents')
            CREATE TABLE [dbo].[DeviceAgents] (
                [id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [workstationId]   UNIQUEIDENTIFIER NOT NULL,
                [providerType]    NVARCHAR(50)     NOT NULL,
                [clientId]        NVARCHAR(255)    NOT NULL,
                [clientSecret]    NVARCHAR(512)    NULL,
                [secretVersion]   NVARCHAR(100)    NULL,
                [version]         NVARCHAR(100)    NULL,
                [isEnabled]       BIT              NOT NULL DEFAULT 1,
                [socketId]        NVARCHAR(255)    NULL,
                [isConnected]     BIT              NOT NULL DEFAULT 0,
                [deviceConnected] BIT              NULL,
                [connectedAt]     DATETIME2        NULL,
                [lastSeenAt]      DATETIME2        NULL,
                [disconnectedAt]  DATETIME2        NULL,
                [capabilitiesJson] NVARCHAR(MAX)   NULL,
                [createdAt]       DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]       DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]       UNIQUEIDENTIFIER NULL,
                [updatedBy]       UNIQUEIDENTIFIER NULL,
                [isActive]        BIT              NOT NULL DEFAULT 1,
                CONSTRAINT [PK_DeviceAgents] PRIMARY KEY ([id]),
                CONSTRAINT [FK_DeviceAgents_Workstation] FOREIGN KEY ([workstationId]) REFERENCES [dbo].[Workstations]([id])
            )
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceAgents_ClientId')
            CREATE UNIQUE INDEX [IX_DeviceAgents_ClientId] ON [dbo].[DeviceAgents] ([clientId])
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceAgents_Workstation_Provider')
            CREATE INDEX [IX_DeviceAgents_Workstation_Provider] ON [dbo].[DeviceAgents] ([workstationId], [providerType])
        `);

        // ── UserWorkstationSessions ──
        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserWorkstationSessions')
            CREATE TABLE [dbo].[UserWorkstationSessions] (
                [id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [userId]         UNIQUEIDENTIFIER NOT NULL,
                [workstationId]  UNIQUEIDENTIFIER NOT NULL,
                [userSocketId]   NVARCHAR(255)    NOT NULL,
                [sessionId]      NVARCHAR(255)    NULL,
                [connectedAt]    DATETIME2        NOT NULL,
                [lastSeenAt]     DATETIME2        NOT NULL,
                [disconnectedAt] DATETIME2        NULL,
                [createdAt]      DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]      DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]      UNIQUEIDENTIFIER NULL,
                [updatedBy]      UNIQUEIDENTIFIER NULL,
                [isActive]       BIT              NOT NULL DEFAULT 1,
                CONSTRAINT [PK_UserWorkstationSessions] PRIMARY KEY ([id]),
                CONSTRAINT [FK_UserWorkstationSessions_Workstation] FOREIGN KEY ([workstationId]) REFERENCES [dbo].[Workstations]([id])
            )
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserWorkstationSessions_UserId')
            CREATE INDEX [IX_UserWorkstationSessions_UserId] ON [dbo].[UserWorkstationSessions] ([userId])
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserWorkstationSessions_Workstation')
            CREATE INDEX [IX_UserWorkstationSessions_Workstation] ON [dbo].[UserWorkstationSessions] ([workstationId])
        `);

        // ── DeviceCommandLogs ──
        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceCommandLogs')
            CREATE TABLE [dbo].[DeviceCommandLogs] (
                [id]                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [requestedByUserId]   UNIQUEIDENTIFIER NOT NULL,
                [workstationId]       UNIQUEIDENTIFIER NOT NULL,
                [providerType]        NVARCHAR(50)     NOT NULL,
                [commandType]         NVARCHAR(100)    NOT NULL,
                [targetAgentId]       UNIQUEIDENTIFIER NULL,
                [correlationId]       NVARCHAR(255)    NOT NULL,
                [status]              NVARCHAR(50)     NOT NULL DEFAULT 'pending',
                [requestPayloadJson]  NVARCHAR(MAX)    NULL,
                [responsePayloadJson] NVARCHAR(MAX)    NULL,
                [errorMessage]        NVARCHAR(MAX)    NULL,
                [completedAt]         DATETIME2        NULL,
                [createdAt]           DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]           DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]           UNIQUEIDENTIFIER NULL,
                [updatedBy]           UNIQUEIDENTIFIER NULL,
                [isActive]            BIT              NOT NULL DEFAULT 1,
                CONSTRAINT [PK_DeviceCommandLogs] PRIMARY KEY ([id]),
                CONSTRAINT [FK_DeviceCommandLogs_Workstation] FOREIGN KEY ([workstationId]) REFERENCES [dbo].[Workstations]([id]),
                CONSTRAINT [FK_DeviceCommandLogs_Agent] FOREIGN KEY ([targetAgentId]) REFERENCES [dbo].[DeviceAgents]([id])
            )
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceCommandLogs_CorrelationId')
            CREATE INDEX [IX_DeviceCommandLogs_CorrelationId] ON [dbo].[DeviceCommandLogs] ([correlationId])
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceCommandLogs_RequestedBy')
            CREATE INDEX [IX_DeviceCommandLogs_RequestedBy] ON [dbo].[DeviceCommandLogs] ([requestedByUserId])
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceCommandLogs_Status')
            CREATE INDEX [IX_DeviceCommandLogs_Status] ON [dbo].[DeviceCommandLogs] ([status])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS [dbo].[DeviceCommandLogs]`);
        await queryRunner.query(`DROP TABLE IF EXISTS [dbo].[UserWorkstationSessions]`);
        await queryRunner.query(`DROP TABLE IF EXISTS [dbo].[DeviceAgents]`);
        await queryRunner.query(`DROP TABLE IF EXISTS [dbo].[WorkstationEnrollmentTokens]`);
        await queryRunner.query(`DROP TABLE IF EXISTS [dbo].[WorkstationRoles]`);
        await queryRunner.query(`DROP TABLE IF EXISTS [dbo].[WorkstationUsers]`);
        await queryRunner.query(`DROP TABLE IF EXISTS [dbo].[Workstations]`);
    }
}
