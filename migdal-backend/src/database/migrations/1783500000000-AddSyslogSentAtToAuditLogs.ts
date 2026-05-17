import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSyslogSentAtToAuditLogs1783500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [AuditLogs] ADD [syslogSentAt] DATETIME2 NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [AuditLogs] DROP COLUMN [syslogSentAt]`,
        );
    }
}
