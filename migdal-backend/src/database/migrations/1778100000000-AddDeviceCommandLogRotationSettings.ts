import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceCommandLogRotationSettings1778100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove old settings if they exist (from previous iteration)
        await queryRunner.query(`DELETE FROM Settings WHERE [key] IN ('retention.deviceCommandLogsEnabled', 'retention.deviceCommandLogsDays', 'retention.deviceCommandLogsBatchSize')`);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT 1 FROM Settings WHERE [key] = 'retention.deviceCommandLogsMonths')
            INSERT INTO Settings ([id], [key], [value], [type], [group], [label], [description], [isPublic], [isActive], [createdAt], [updatedAt])
            VALUES (
                NEWID(),
                'retention.deviceCommandLogsMonths',
                '3',
                'number',
                'retention',
                N'Device Command Logs Retention (Months)',
                N'Number of months to keep completed device command logs before automatic deletion',
                0, 1, GETDATE(), GETDATE()
            )
        `);

        // Index for efficient cleanup queries on createdAt + status
        await queryRunner.query(`
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DeviceCommandLogs_Status_CreatedAt' AND object_id = OBJECT_ID('DeviceCommandLogs'))
            CREATE INDEX IX_DeviceCommandLogs_Status_CreatedAt ON DeviceCommandLogs (status, createdAt)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM Settings WHERE [key] = 'retention.deviceCommandLogsMonths'`);
        await queryRunner.query(`DROP INDEX IF EXISTS IX_DeviceCommandLogs_Status_CreatedAt ON DeviceCommandLogs`);
    }
}
