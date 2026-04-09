import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorVisitorsAndEscorts1775400000000 implements MigrationInterface {
    name = 'RefactorVisitorsAndEscorts1775400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── Step 1: Drop all FK constraints on tables we're renaming ──
        const fksToDiscover = ['VisitEscorts', 'EscortAccessLogs', 'VisitEscortStatus'];
        for (const table of fksToDiscover) {
            const fks = await queryRunner.query(`
                SELECT fk.name AS fk_name
                FROM sys.foreign_keys fk
                INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
                WHERE t.name = '${table}'
            `);
            for (const fk of fks) {
                await queryRunner.query(`ALTER TABLE [${table}] DROP CONSTRAINT [${fk.fk_name}]`);
            }
        }

        // ── Step 2: Drop all non-clustered indexes ──
        for (const table of fksToDiscover) {
            const idxs = await queryRunner.query(`
                SELECT i.name AS idx_name
                FROM sys.indexes i
                INNER JOIN sys.tables t ON i.object_id = t.object_id
                WHERE t.name = '${table}' AND i.is_primary_key = 0 AND i.type > 0
            `);
            for (const idx of idxs) {
                await queryRunner.query(`DROP INDEX [${idx.idx_name}] ON [${table}]`);
            }
        }

        // ── Step 3: Rename VisitEscorts → VisitVisitors ──
        // First rename the column visitEscortId references in child tables
        await queryRunner.query(`EXEC sp_rename 'EscortAccessLogs.visitEscortId', 'visitVisitorId', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'VisitEscortStatus.visitEscortId', 'visitVisitorId', 'COLUMN'`);

        // Rename tables
        await queryRunner.query(`EXEC sp_rename 'VisitEscorts', 'VisitVisitors'`);
        await queryRunner.query(`EXEC sp_rename 'EscortAccessLogs', 'VisitorAccessLogs'`);
        await queryRunner.query(`EXEC sp_rename 'VisitEscortStatus', 'VisitVisitorStatus'`);

        // Rename PK constraints
        const visitVisitorPK = await queryRunner.query(`
            SELECT kc.name FROM sys.key_constraints kc
            INNER JOIN sys.tables t ON kc.parent_object_id = t.object_id
            WHERE t.name = 'VisitVisitors' AND kc.type = 'PK'
        `);
        if (visitVisitorPK.length > 0) {
            await queryRunner.query(`EXEC sp_rename '${visitVisitorPK[0].name}', 'PK_VisitVisitors', 'OBJECT'`);
        }

        const accessLogPK = await queryRunner.query(`
            SELECT kc.name FROM sys.key_constraints kc
            INNER JOIN sys.tables t ON kc.parent_object_id = t.object_id
            WHERE t.name = 'VisitorAccessLogs' AND kc.type = 'PK'
        `);
        if (accessLogPK.length > 0) {
            await queryRunner.query(`EXEC sp_rename '${accessLogPK[0].name}', 'PK_VisitorAccessLogs', 'OBJECT'`);
        }

        const statusPK = await queryRunner.query(`
            SELECT kc.name FROM sys.key_constraints kc
            INNER JOIN sys.tables t ON kc.parent_object_id = t.object_id
            WHERE t.name = 'VisitVisitorStatus' AND kc.type = 'PK'
        `);
        if (statusPK.length > 0) {
            await queryRunner.query(`EXEC sp_rename '${statusPK[0].name}', 'PK_VisitVisitorStatus', 'OBJECT'`);
        }

        // ── Step 4: Recreate FK constraints for renamed tables ──
        // VisitVisitors FKs
        await queryRunner.query(`ALTER TABLE [VisitVisitors] ADD CONSTRAINT [FK_VisitVisitors_visitId] FOREIGN KEY ([visitId]) REFERENCES [Visits]([id]) ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE [VisitVisitors] ADD CONSTRAINT [FK_VisitVisitors_visitorId] FOREIGN KEY ([visitorId]) REFERENCES [Visitors]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [VisitVisitors] ADD CONSTRAINT [FK_VisitVisitors_accessLevelId] FOREIGN KEY ([accessLevelId]) REFERENCES [AccessLevels]([id]) ON DELETE NO ACTION`);

        // VisitorAccessLogs FKs
        await queryRunner.query(`ALTER TABLE [VisitorAccessLogs] ADD CONSTRAINT [FK_VisitorAccessLogs_visitVisitorId] FOREIGN KEY ([visitVisitorId]) REFERENCES [VisitVisitors]([id]) ON DELETE NO ACTION`);

        // VisitVisitorStatus FKs
        await queryRunner.query(`ALTER TABLE [VisitVisitorStatus] ADD CONSTRAINT [FK_VisitVisitorStatus_visitVisitorId] FOREIGN KEY ([visitVisitorId]) REFERENCES [VisitVisitors]([id]) ON DELETE CASCADE`);

        // ── Step 5: Recreate indexes ──
        await queryRunner.query(`CREATE INDEX [IX_VisitVisitors_visitId] ON [VisitVisitors]([visitId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitVisitors_visitorId] ON [VisitVisitors]([visitorId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitorAccessLogs_visitVisitorId] ON [VisitorAccessLogs]([visitVisitorId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitorAccessLogs_visitId] ON [VisitorAccessLogs]([visitId])`);

        // ── Step 6: Create new VisitEscorts table (free-text escorts) ──
        // Drop existing columns from VisitVisitors that are no longer needed for new VisitEscorts
        // The old VisitEscorts columns (visitorId, accessLevelId, notes) stay on VisitVisitors.
        // New VisitEscorts is a completely new table for free-text escort data.
        await queryRunner.query(`
            CREATE TABLE [VisitEscorts] (
                [id] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
                [visitId] uniqueidentifier NOT NULL,
                [firstName] nvarchar(200) NOT NULL,
                [lastName] nvarchar(200) NOT NULL,
                [phone] nvarchar(50) NOT NULL,
                [email] nvarchar(320) NOT NULL,
                [isActive] bit NOT NULL DEFAULT 1,
                [createdAt] datetime2 NOT NULL DEFAULT GETDATE(),
                [updatedAt] datetime2 NOT NULL DEFAULT GETDATE(),
                [createdBy] uniqueidentifier NULL,
                [updatedBy] uniqueidentifier NULL,
                CONSTRAINT [PK_VisitEscorts] PRIMARY KEY ([id]),
                CONSTRAINT [FK_VisitEscorts_visitId] FOREIGN KEY ([visitId]) REFERENCES [Visits]([id]) ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX [IX_VisitEscorts_visitId] ON [VisitEscorts]([visitId])`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop new VisitEscorts table
        await queryRunner.query(`DROP TABLE IF EXISTS [VisitEscorts]`);

        // Drop FK constraints on renamed tables
        const fksToDiscover = ['VisitVisitors', 'VisitorAccessLogs', 'VisitVisitorStatus'];
        for (const table of fksToDiscover) {
            const fks = await queryRunner.query(`
                SELECT fk.name AS fk_name
                FROM sys.foreign_keys fk
                INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
                WHERE t.name = '${table}'
            `);
            for (const fk of fks) {
                await queryRunner.query(`ALTER TABLE [${table}] DROP CONSTRAINT [${fk.fk_name}]`);
            }
        }

        // Drop indexes
        for (const table of fksToDiscover) {
            const idxs = await queryRunner.query(`
                SELECT i.name AS idx_name
                FROM sys.indexes i
                INNER JOIN sys.tables t ON i.object_id = t.object_id
                WHERE t.name = '${table}' AND i.is_primary_key = 0 AND i.type > 0
            `);
            for (const idx of idxs) {
                await queryRunner.query(`DROP INDEX [${idx.idx_name}] ON [${table}]`);
            }
        }

        // Rename tables back
        await queryRunner.query(`EXEC sp_rename 'VisitVisitors', 'VisitEscorts'`);
        await queryRunner.query(`EXEC sp_rename 'VisitorAccessLogs', 'EscortAccessLogs'`);
        await queryRunner.query(`EXEC sp_rename 'VisitVisitorStatus', 'VisitEscortStatus'`);

        // Rename columns back
        await queryRunner.query(`EXEC sp_rename 'EscortAccessLogs.visitVisitorId', 'visitEscortId', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'VisitEscortStatus.visitVisitorId', 'visitEscortId', 'COLUMN'`);

        // Recreate FK constraints for original names
        await queryRunner.query(`ALTER TABLE [VisitEscorts] ADD CONSTRAINT [FK_VisitEscorts_visitId] FOREIGN KEY ([visitId]) REFERENCES [Visits]([id]) ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE [VisitEscorts] ADD CONSTRAINT [FK_VisitEscorts_visitorId] FOREIGN KEY ([visitorId]) REFERENCES [Visitors]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [VisitEscorts] ADD CONSTRAINT [FK_VisitEscorts_accessLevelId] FOREIGN KEY ([accessLevelId]) REFERENCES [AccessLevels]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [EscortAccessLogs] ADD CONSTRAINT [FK_EscortAccessLogs_visitEscortId] FOREIGN KEY ([visitEscortId]) REFERENCES [VisitEscorts]([id]) ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE [VisitEscortStatus] ADD CONSTRAINT [FK_VisitEscortStatus_visitEscortId] FOREIGN KEY ([visitEscortId]) REFERENCES [VisitEscorts]([id]) ON DELETE CASCADE`);

        // Recreate indexes
        await queryRunner.query(`CREATE INDEX [IX_VisitEscorts_visitId] ON [VisitEscorts]([visitId])`);
        await queryRunner.query(`CREATE INDEX [IX_VisitEscorts_visitorId] ON [VisitEscorts]([visitorId])`);
        await queryRunner.query(`CREATE INDEX [IX_EscortAccessLogs_visitEscortId] ON [EscortAccessLogs]([visitEscortId])`);
        await queryRunner.query(`CREATE INDEX [IX_EscortAccessLogs_visitId] ON [EscortAccessLogs]([visitId])`);
    }
}
