import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyVisitorEntity1775900000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes on columns being removed
        await queryRunner.query(`IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Visitors_Status' AND object_id = OBJECT_ID('Visitors')) DROP INDEX [IX_Visitors_Status] ON [Visitors]`);
        await queryRunner.query(`IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Visitors_VisitDate' AND object_id = OBJECT_ID('Visitors')) DROP INDEX [IX_Visitors_VisitDate] ON [Visitors]`);

        // Drop columns that are no longer part of the Visitor entity
        const columnsToDrop = [
            'purpose',
            'visitDate',
            'visitStartTime',
            'visitEndTime',
            'status',
            'checkInAt',
            'checkOutAt',
            'fullName',
            'badgeNumber',
            'notes',
        ];

        for (const col of columnsToDrop) {
            // Drop any default constraints on the column first (MSSQL requirement)
            await queryRunner.query(`
                DECLARE @constraint NVARCHAR(255)
                SELECT @constraint = dc.name
                FROM sys.default_constraints dc
                JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                WHERE dc.parent_object_id = OBJECT_ID('Visitors') AND c.name = '${col}'
                IF @constraint IS NOT NULL
                    EXEC('ALTER TABLE [Visitors] DROP CONSTRAINT [' + @constraint + ']')
            `);
            // Drop the column if it exists
            await queryRunner.query(`
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Visitors' AND COLUMN_NAME = '${col}')
                BEGIN
                    ALTER TABLE [Visitors] DROP COLUMN [${col}]
                END
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add removed columns
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [purpose] NVARCHAR(500) NULL`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [visitDate] DATE NULL`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [visitStartTime] TIME NULL`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [visitEndTime] TIME NULL`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [status] NVARCHAR(50) NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [checkInAt] DATETIME2 NULL`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [checkOutAt] DATETIME2 NULL`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [fullName] NVARCHAR(200) NULL`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [badgeNumber] NVARCHAR(50) NULL`);
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [notes] NVARCHAR(1000) NULL`);

        // Re-create indexes
        await queryRunner.query(`CREATE INDEX [IX_Visitors_Status] ON [Visitors] ([status])`);
        await queryRunner.query(`CREATE INDEX [IX_Visitors_VisitDate] ON [Visitors] ([visitDate])`);
    }
}
