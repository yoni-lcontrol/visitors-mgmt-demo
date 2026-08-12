import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kiosk-originated device commands are anonymous — there is no logged-in user to
 * attribute them to — so [DeviceCommandLogs].[requestedByUserId] must allow NULL.
 * The column is only indexed (IX_DeviceCommandLogs_RequestedBy); it carries no FK,
 * so the index has to be dropped and recreated around the ALTER COLUMN.
 */
export class MakeDeviceCommandLogRequestedByNullable1785200000000 implements MigrationInterface {
    name = 'MakeDeviceCommandLogRequestedByNullable1785200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceCommandLogs_RequestedBy')
            DROP INDEX [IX_DeviceCommandLogs_RequestedBy] ON [dbo].[DeviceCommandLogs]
        `);

        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceCommandLogs')
            ALTER TABLE [dbo].[DeviceCommandLogs] ALTER COLUMN [requestedByUserId] UNIQUEIDENTIFIER NULL
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceCommandLogs_RequestedBy')
            CREATE INDEX [IX_DeviceCommandLogs_RequestedBy] ON [dbo].[DeviceCommandLogs] ([requestedByUserId])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceCommandLogs_RequestedBy')
            DROP INDEX [IX_DeviceCommandLogs_RequestedBy] ON [dbo].[DeviceCommandLogs]
        `);

        // Backfill anonymous (kiosk) rows before restoring the NOT NULL constraint
        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceCommandLogs')
            UPDATE [dbo].[DeviceCommandLogs]
            SET [requestedByUserId] = '00000000-0000-0000-0000-000000000000'
            WHERE [requestedByUserId] IS NULL
        `);

        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'DeviceCommandLogs')
            ALTER TABLE [dbo].[DeviceCommandLogs] ALTER COLUMN [requestedByUserId] UNIQUEIDENTIFIER NOT NULL
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceCommandLogs_RequestedBy')
            CREATE INDEX [IX_DeviceCommandLogs_RequestedBy] ON [dbo].[DeviceCommandLogs] ([requestedByUserId])
        `);
    }
}
