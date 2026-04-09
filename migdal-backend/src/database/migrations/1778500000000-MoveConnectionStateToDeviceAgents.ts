import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveConnectionStateToDeviceAgents1778500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add connection-state columns to DeviceAgents
        await queryRunner.query(`
            ALTER TABLE [DeviceAgents]
            ADD [socketId] nvarchar(255) NULL,
                [isConnected] bit NOT NULL CONSTRAINT [DF_DeviceAgents_isConnected] DEFAULT 0,
                [connectedAt] datetime2 NULL,
                [lastSeenAt] datetime2 NULL,
                [disconnectedAt] datetime2 NULL,
                [capabilitiesJson] nvarchar(MAX) NULL
        `);

        // Copy current connected state from AgentConnections into DeviceAgents
        await queryRunner.query(`
            UPDATE da
            SET da.socketId        = ac.socketId,
                da.isConnected     = 1,
                da.connectedAt     = ac.connectedAt,
                da.lastSeenAt      = ac.lastSeenAt,
                da.capabilitiesJson = ac.capabilitiesJson
            FROM DeviceAgents da
            INNER JOIN AgentConnections ac
                ON ac.deviceAgentId = da.id
                AND ac.status = 'connected'
                AND ac.isActive = 1
        `);

        // Drop the AgentConnections table
        await queryRunner.query(`DROP TABLE [AgentConnections]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate AgentConnections table
        await queryRunner.query(`
            CREATE TABLE [AgentConnections] (
                [id] uniqueidentifier NOT NULL CONSTRAINT [DF_AgentConnections_id] DEFAULT NEWSEQUENTIALID(),
                [deviceAgentId] uniqueidentifier NOT NULL,
                [workstationId] uniqueidentifier NOT NULL,
                [providerType] nvarchar(50) NOT NULL,
                [socketId] nvarchar(255) NOT NULL,
                [status] nvarchar(50) NOT NULL CONSTRAINT [DF_AgentConnections_status] DEFAULT 'connected',
                [capabilitiesJson] nvarchar(MAX) NULL,
                [connectedAt] datetime2 NOT NULL,
                [lastSeenAt] datetime2 NOT NULL,
                [disconnectedAt] datetime2 NULL,
                [isActive] bit NOT NULL CONSTRAINT [DF_AgentConnections_isActive] DEFAULT 1,
                [createdAt] datetime2 NOT NULL CONSTRAINT [DF_AgentConnections_createdAt] DEFAULT GETDATE(),
                [updatedAt] datetime2 NOT NULL CONSTRAINT [DF_AgentConnections_updatedAt] DEFAULT GETDATE(),
                [createdBy] uniqueidentifier NULL,
                [updatedBy] uniqueidentifier NULL,
                CONSTRAINT [PK_AgentConnections] PRIMARY KEY ([id])
            )
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_AgentConnections_Workstation_Provider]
            ON [AgentConnections] ([workstationId], [providerType])
        `);

        // Remove columns from DeviceAgents
        await queryRunner.query(`
            ALTER TABLE [DeviceAgents] DROP CONSTRAINT [DF_DeviceAgents_isConnected]
        `);
        await queryRunner.query(`
            ALTER TABLE [DeviceAgents]
            DROP COLUMN [socketId], [isConnected], [connectedAt], [lastSeenAt], [disconnectedAt], [capabilitiesJson]
        `);
    }
}
