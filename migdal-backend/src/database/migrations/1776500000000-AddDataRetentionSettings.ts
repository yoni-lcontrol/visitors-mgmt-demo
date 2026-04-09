import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDataRetentionSettings1776500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Seed retention settings into the Settings key-value table
        await queryRunner.query(`
            INSERT INTO Settings ([id], [key], [value], [type], [group], [label], [description], [isPublic], [isActive], [createdAt], [updatedAt])
            VALUES (
                NEWID(),
                'retention.auditLogsMonths',
                '3',
                'number',
                'retention',
                N'Audit Logs Retention (Months)',
                N'Number of months to keep audit log records. Leave empty to disable automatic cleanup.',
                0, 1, GETDATE(), GETDATE()
            )
        `);

        await queryRunner.query(`
            INSERT INTO Settings ([id], [key], [value], [type], [group], [label], [description], [isPublic], [isActive], [createdAt], [updatedAt])
            VALUES (
                NEWID(),
                'retention.visitsMonths',
                '3',
                'number',
                'retention',
                N'Visits Retention (Months)',
                N'Number of months to keep visit records. Leave empty to disable automatic cleanup.',
                0, 1, GETDATE(), GETDATE()
            )
        `);

        // Ensure indexes exist on createdAt for efficient cleanup queries
        await queryRunner.query(`
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_createdAt' AND object_id = OBJECT_ID('AuditLogs'))
            CREATE INDEX IX_AuditLogs_createdAt ON AuditLogs (createdAt)
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Visits_createdAt' AND object_id = OBJECT_ID('Visits'))
            CREATE INDEX IX_Visits_createdAt ON Visits (createdAt)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM Settings WHERE [key] IN ('retention.auditLogsMonths', 'retention.visitsMonths')`);
        await queryRunner.query(`DROP INDEX IF EXISTS IX_AuditLogs_createdAt ON AuditLogs`);
        await queryRunner.query(`DROP INDEX IF EXISTS IX_Visits_createdAt ON Visits`);
    }
}
