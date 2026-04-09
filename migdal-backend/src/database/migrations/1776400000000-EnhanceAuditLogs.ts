import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceAuditLogs1776400000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add missing columns
        await queryRunner.query(`ALTER TABLE [AuditLogs] ADD [module] NVARCHAR(100) NULL`);
        await queryRunner.query(`ALTER TABLE [AuditLogs] ADD [description] NVARCHAR(500) NULL`);
        await queryRunner.query(`ALTER TABLE [AuditLogs] ADD [performedByEmail] NVARCHAR(255) NULL`);
        await queryRunner.query(`ALTER TABLE [AuditLogs] ADD [metadata] NVARCHAR(MAX) NULL`);

        // Add indexes for performance at scale
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_AuditLogs_createdAt] ON [AuditLogs] ([createdAt] DESC)`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_AuditLogs_module] ON [AuditLogs] ([module])`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_AuditLogs_action] ON [AuditLogs] ([action])`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_AuditLogs_userId] ON [AuditLogs] ([userId])`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_AuditLogs_entity_entityId] ON [AuditLogs] ([entity], [entityId])`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_AuditLogs_entity_entityId] ON [AuditLogs]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_AuditLogs_userId] ON [AuditLogs]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_AuditLogs_action] ON [AuditLogs]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_AuditLogs_module] ON [AuditLogs]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_AuditLogs_createdAt] ON [AuditLogs]`);

        await queryRunner.query(`ALTER TABLE [AuditLogs] DROP COLUMN [metadata]`);
        await queryRunner.query(`ALTER TABLE [AuditLogs] DROP COLUMN [performedByEmail]`);
        await queryRunner.query(`ALTER TABLE [AuditLogs] DROP COLUMN [description]`);
        await queryRunner.query(`ALTER TABLE [AuditLogs] DROP COLUMN [module]`);
    }
}
