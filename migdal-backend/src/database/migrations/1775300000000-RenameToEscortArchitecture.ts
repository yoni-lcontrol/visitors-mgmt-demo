import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameToEscortArchitecture1775300000000 implements MigrationInterface {
    name = 'RenameToEscortArchitecture1775300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop VisitVisitorEscorts table (inline escorts are replaced by Visitor records)
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'ALTER TABLE [dbo].[VisitVisitorEscorts] DROP CONSTRAINT [' + fk.name + '];'
            FROM sys.foreign_keys fk
            WHERE fk.parent_object_id = OBJECT_ID('dbo.VisitVisitorEscorts');
            IF @sql <> '' EXEC sp_executesql @sql;
        `);
        await queryRunner.query(`DROP TABLE IF EXISTS [dbo].[VisitVisitorEscorts]`);

        // 2. Drop all FK constraints FROM VisitorAccessLogs (parent)
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'ALTER TABLE [dbo].[VisitorAccessLogs] DROP CONSTRAINT [' + fk.name + '];'
            FROM sys.foreign_keys fk
            WHERE fk.parent_object_id = OBJECT_ID('dbo.VisitorAccessLogs');
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        // 3. Drop all FK constraints FROM VisitVisitorStatus (parent)
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'ALTER TABLE [dbo].[VisitVisitorStatus] DROP CONSTRAINT [' + fk.name + '];'
            FROM sys.foreign_keys fk
            WHERE fk.parent_object_id = OBJECT_ID('dbo.VisitVisitorStatus');
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        // 4. Drop FKs that REFERENCE VisitVisitors (from other tables pointing at it)
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'ALTER TABLE [' + OBJECT_SCHEMA_NAME(fk.parent_object_id) + '].[' + OBJECT_NAME(fk.parent_object_id) + '] DROP CONSTRAINT [' + fk.name + '];'
            FROM sys.foreign_keys fk
            WHERE fk.referenced_object_id = OBJECT_ID('dbo.VisitVisitors');
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        // 5. Drop FKs FROM VisitVisitors
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'ALTER TABLE [dbo].[VisitVisitors] DROP CONSTRAINT [' + fk.name + '];'
            FROM sys.foreign_keys fk
            WHERE fk.parent_object_id = OBJECT_ID('dbo.VisitVisitors');
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        // 6. Drop unique constraints on VisitVisitors (must come before index drop)
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'ALTER TABLE [dbo].[VisitVisitors] DROP CONSTRAINT [' + kc.name + '];'
            FROM sys.key_constraints kc
            WHERE kc.parent_object_id = OBJECT_ID('dbo.VisitVisitors') AND kc.type = 'UQ';
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        // 7. Drop indexes on tables being renamed (they keep old names after sp_rename)
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'DROP INDEX [' + i.name + '] ON [dbo].[VisitVisitors];'
            FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('dbo.VisitVisitors') AND i.is_primary_key = 0 AND i.name IS NOT NULL;
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'DROP INDEX [' + i.name + '] ON [dbo].[VisitorAccessLogs];'
            FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('dbo.VisitorAccessLogs') AND i.is_primary_key = 0 AND i.name IS NOT NULL;
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'DROP INDEX [' + i.name + '] ON [dbo].[VisitVisitorStatus];'
            FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('dbo.VisitVisitorStatus') AND i.is_primary_key = 0 AND i.name IS NOT NULL;
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        // 8. Rename tables
        await queryRunner.query(`EXEC sp_rename 'dbo.VisitVisitors', 'VisitEscorts'`);
        await queryRunner.query(`EXEC sp_rename 'dbo.VisitorAccessLogs', 'EscortAccessLogs'`);
        await queryRunner.query(`EXEC sp_rename 'dbo.VisitVisitorStatus', 'VisitEscortStatus'`);

        // 9. Rename columns: visitVisitorId → visitEscortId
        await queryRunner.query(`EXEC sp_rename 'dbo.EscortAccessLogs.visitVisitorId', 'visitEscortId', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'dbo.VisitEscortStatus.visitVisitorId', 'visitEscortId', 'COLUMN'`);

        // 10. Recreate PK constraint names for renamed tables
        // VisitEscorts already has PK from before (renamed automatically), rename it
        await queryRunner.query(`
            DECLARE @pkName NVARCHAR(200);
            SELECT @pkName = kc.name
            FROM sys.key_constraints kc
            WHERE kc.parent_object_id = OBJECT_ID('dbo.VisitEscorts') AND kc.type = 'PK';
            IF @pkName IS NOT NULL AND @pkName <> 'PK_VisitEscorts'
                EXEC sp_rename @pkName, 'PK_VisitEscorts', 'OBJECT';
        `);

        await queryRunner.query(`
            DECLARE @pkName NVARCHAR(200);
            SELECT @pkName = kc.name
            FROM sys.key_constraints kc
            WHERE kc.parent_object_id = OBJECT_ID('dbo.EscortAccessLogs') AND kc.type = 'PK';
            IF @pkName IS NOT NULL AND @pkName <> 'PK_EscortAccessLogs'
                EXEC sp_rename @pkName, 'PK_EscortAccessLogs', 'OBJECT';
        `);

        await queryRunner.query(`
            DECLARE @pkName NVARCHAR(200);
            SELECT @pkName = kc.name
            FROM sys.key_constraints kc
            WHERE kc.parent_object_id = OBJECT_ID('dbo.VisitEscortStatus') AND kc.type = 'PK';
            IF @pkName IS NOT NULL AND @pkName <> 'PK_VisitEscortStatus'
                EXEC sp_rename @pkName, 'PK_VisitEscortStatus', 'OBJECT';
        `);

        // 11. Recreate FK constraints with proper names
        // VisitEscorts
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscorts] ADD CONSTRAINT [FK_VisitEscorts_visitId] FOREIGN KEY ([visitId]) REFERENCES [dbo].[Visits]([id]) ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscorts] ADD CONSTRAINT [FK_VisitEscorts_visitorId] FOREIGN KEY ([visitorId]) REFERENCES [dbo].[Visitors]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscorts] ADD CONSTRAINT [FK_VisitEscorts_accessLevelId] FOREIGN KEY ([accessLevelId]) REFERENCES [dbo].[AccessLevels]([id]) ON DELETE NO ACTION`);

        // EscortAccessLogs
        await queryRunner.query(`ALTER TABLE [dbo].[EscortAccessLogs] ADD CONSTRAINT [FK_EscortAccessLogs_visitEscortId] FOREIGN KEY ([visitEscortId]) REFERENCES [dbo].[VisitEscorts]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[EscortAccessLogs] ADD CONSTRAINT [FK_EscortAccessLogs_visitId] FOREIGN KEY ([visitId]) REFERENCES [dbo].[Visits]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[EscortAccessLogs] ADD CONSTRAINT [FK_EscortAccessLogs_visitorId] FOREIGN KEY ([visitorId]) REFERENCES [dbo].[Visitors]([id]) ON DELETE NO ACTION`);

        // VisitEscortStatus
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscortStatus] ADD CONSTRAINT [FK_VisitEscortStatus_visitEscortId] FOREIGN KEY ([visitEscortId]) REFERENCES [dbo].[VisitEscorts]([id]) ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscortStatus] ADD CONSTRAINT [FK_VisitEscortStatus_visitId] FOREIGN KEY ([visitId]) REFERENCES [dbo].[Visits]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscortStatus] ADD CONSTRAINT [FK_VisitEscortStatus_visitorId] FOREIGN KEY ([visitorId]) REFERENCES [dbo].[Visitors]([id]) ON DELETE NO ACTION`);

        // 12. Recreate indexes with proper names
        // VisitEscorts
        await queryRunner.query(`CREATE INDEX [IX_VisitEscorts_visitId] ON [dbo].[VisitEscorts] ([visitId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitEscorts_visitorId] ON [dbo].[VisitEscorts] ([visitorId])`);
        await queryRunner.query(`CREATE UNIQUE INDEX [UQ_VisitEscorts_visit_visitor] ON [dbo].[VisitEscorts] ([visitId], [visitorId])`);

        // EscortAccessLogs
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_EscortAccessLogs_visitEscortId_eventTime] ON [dbo].[EscortAccessLogs] ([visitEscortId], [eventTimeUtc] DESC)`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_EscortAccessLogs_visitId_eventTime] ON [dbo].[EscortAccessLogs] ([visitId], [eventTimeUtc] DESC)`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_EscortAccessLogs_visitorId_eventTime] ON [dbo].[EscortAccessLogs] ([visitorId], [eventTimeUtc] DESC)`);

        // VisitEscortStatus
        await queryRunner.query(`CREATE INDEX [IX_VisitEscortStatus_visitId] ON [dbo].[VisitEscortStatus] ([visitId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitEscortStatus_visitorId] ON [dbo].[VisitEscortStatus] ([visitorId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitEscortStatus_currentStatus] ON [dbo].[VisitEscortStatus] ([currentStatus])`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop new indexes
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_VisitEscortStatus_currentStatus] ON [dbo].[VisitEscortStatus]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_VisitEscortStatus_visitorId] ON [dbo].[VisitEscortStatus]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_VisitEscortStatus_visitId] ON [dbo].[VisitEscortStatus]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_EscortAccessLogs_visitorId_eventTime] ON [dbo].[EscortAccessLogs]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_EscortAccessLogs_visitId_eventTime] ON [dbo].[EscortAccessLogs]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_EscortAccessLogs_visitEscortId_eventTime] ON [dbo].[EscortAccessLogs]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [UQ_VisitEscorts_visit_visitor] ON [dbo].[VisitEscorts]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_VisitEscorts_visitorId] ON [dbo].[VisitEscorts]`);
        await queryRunner.query(`DROP INDEX IF EXISTS [IX_VisitEscorts_visitId] ON [dbo].[VisitEscorts]`);

        // Drop new FKs
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscortStatus] DROP CONSTRAINT [FK_VisitEscortStatus_visitorId]`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscortStatus] DROP CONSTRAINT [FK_VisitEscortStatus_visitId]`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscortStatus] DROP CONSTRAINT [FK_VisitEscortStatus_visitEscortId]`);
        await queryRunner.query(`ALTER TABLE [dbo].[EscortAccessLogs] DROP CONSTRAINT [FK_EscortAccessLogs_visitorId]`);
        await queryRunner.query(`ALTER TABLE [dbo].[EscortAccessLogs] DROP CONSTRAINT [FK_EscortAccessLogs_visitId]`);
        await queryRunner.query(`ALTER TABLE [dbo].[EscortAccessLogs] DROP CONSTRAINT [FK_EscortAccessLogs_visitEscortId]`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscorts] DROP CONSTRAINT [FK_VisitEscorts_accessLevelId]`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscorts] DROP CONSTRAINT [FK_VisitEscorts_visitorId]`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitEscorts] DROP CONSTRAINT [FK_VisitEscorts_visitId]`);

        // Rename columns back
        await queryRunner.query(`EXEC sp_rename 'dbo.EscortAccessLogs.visitEscortId', 'visitVisitorId', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'dbo.VisitEscortStatus.visitEscortId', 'visitVisitorId', 'COLUMN'`);

        // Rename tables back
        await queryRunner.query(`EXEC sp_rename 'dbo.VisitEscorts', 'VisitVisitors'`);
        await queryRunner.query(`EXEC sp_rename 'dbo.EscortAccessLogs', 'VisitorAccessLogs'`);
        await queryRunner.query(`EXEC sp_rename 'dbo.VisitEscortStatus', 'VisitVisitorStatus'`);

        // Recreate original FKs
        await queryRunner.query(`ALTER TABLE [dbo].[VisitVisitors] ADD CONSTRAINT [FK_VisitVisitors_visitId] FOREIGN KEY ([visitId]) REFERENCES [dbo].[Visits]([id]) ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitVisitors] ADD CONSTRAINT [FK_VisitVisitors_visitorId] FOREIGN KEY ([visitorId]) REFERENCES [dbo].[Visitors]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitVisitors] ADD CONSTRAINT [FK_VisitVisitors_AccessLevel] FOREIGN KEY ([accessLevelId]) REFERENCES [dbo].[AccessLevels]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitorAccessLogs] ADD CONSTRAINT [FK_VisitorAccessLogs_visitVisitorId] FOREIGN KEY ([visitVisitorId]) REFERENCES [dbo].[VisitVisitors]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitorAccessLogs] ADD CONSTRAINT [FK_VisitorAccessLogs_visitId] FOREIGN KEY ([visitId]) REFERENCES [dbo].[Visits]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitorAccessLogs] ADD CONSTRAINT [FK_VisitorAccessLogs_visitorId] FOREIGN KEY ([visitorId]) REFERENCES [dbo].[Visitors]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitVisitorStatus] ADD CONSTRAINT [FK_VisitVisitorStatus_visitVisitorId] FOREIGN KEY ([visitVisitorId]) REFERENCES [dbo].[VisitVisitors]([id]) ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitVisitorStatus] ADD CONSTRAINT [FK_VisitVisitorStatus_visitId] FOREIGN KEY ([visitId]) REFERENCES [dbo].[Visits]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [dbo].[VisitVisitorStatus] ADD CONSTRAINT [FK_VisitVisitorStatus_visitorId] FOREIGN KEY ([visitorId]) REFERENCES [dbo].[Visitors]([id]) ON DELETE NO ACTION`);

        // Recreate original indexes
        await queryRunner.query(`CREATE INDEX [IX_VisitVisitors_visitId] ON [dbo].[VisitVisitors] ([visitId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitVisitors_visitorId] ON [dbo].[VisitVisitors] ([visitorId])`);
        await queryRunner.query(`CREATE UNIQUE INDEX [UQ_VisitVisitors_visit_visitor] ON [dbo].[VisitVisitors] ([visitId], [visitorId])`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_VisitorAccessLogs_visitVisitorId_eventTime] ON [dbo].[VisitorAccessLogs] ([visitVisitorId], [eventTimeUtc] DESC)`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_VisitorAccessLogs_visitId_eventTime] ON [dbo].[VisitorAccessLogs] ([visitId], [eventTimeUtc] DESC)`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX [IX_VisitorAccessLogs_visitorId_eventTime] ON [dbo].[VisitorAccessLogs] ([visitorId], [eventTimeUtc] DESC)`);
        await queryRunner.query(`CREATE INDEX [IX_VisitVisitorStatus_visitId] ON [dbo].[VisitVisitorStatus] ([visitId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitVisitorStatus_visitorId] ON [dbo].[VisitVisitorStatus] ([visitorId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitVisitorStatus_currentStatus] ON [dbo].[VisitVisitorStatus] ([currentStatus])`);

        // Recreate VisitVisitorEscorts table
        await queryRunner.query(`
            CREATE TABLE [dbo].[VisitVisitorEscorts] (
                [id]               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [visitVisitorId]   UNIQUEIDENTIFIER NOT NULL,
                [firstName]        NVARCHAR(200) NOT NULL,
                [lastName]         NVARCHAR(200) NOT NULL,
                [phone]            NVARCHAR(50)  NOT NULL,
                [email]            NVARCHAR(320) NOT NULL,
                [createdAt]        DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                [updatedAt]        DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                [createdBy]        UNIQUEIDENTIFIER NULL,
                [updatedBy]        UNIQUEIDENTIFIER NULL,
                [isActive]         BIT NOT NULL DEFAULT 1,
                CONSTRAINT [PK_VisitVisitorEscorts] PRIMARY KEY ([id]),
                CONSTRAINT [FK_VisitVisitorEscorts_VisitVisitor]
                    FOREIGN KEY ([visitVisitorId]) REFERENCES [dbo].[VisitVisitors]([id])
                    ON DELETE CASCADE
            )
        `);
    }
}
