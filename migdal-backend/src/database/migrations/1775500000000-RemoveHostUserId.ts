import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveHostUserId1775500000000 implements MigrationInterface {
    name = 'RemoveHostUserId1775500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop FK and index from Visitors table
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'ALTER TABLE [dbo].[Visitors] DROP CONSTRAINT [' + fk.name + '];'
            FROM sys.foreign_keys fk
            WHERE fk.parent_object_id = OBJECT_ID('dbo.Visitors')
              AND EXISTS (
                  SELECT 1 FROM sys.foreign_key_columns fkc
                  INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
                  WHERE fkc.constraint_object_id = fk.object_id AND c.name = 'hostUserId'
              );
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'DROP INDEX [' + i.name + '] ON [dbo].[Visitors];'
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE i.object_id = OBJECT_ID('dbo.Visitors') AND c.name = 'hostUserId' AND i.is_primary_key = 0;
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        await queryRunner.query(`
            IF COL_LENGTH('dbo.Visitors', 'hostUserId') IS NOT NULL
                ALTER TABLE [dbo].[Visitors] DROP COLUMN [hostUserId];
        `);

        // Drop FK and index from Visits table
        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'ALTER TABLE [dbo].[Visits] DROP CONSTRAINT [' + fk.name + '];'
            FROM sys.foreign_keys fk
            WHERE fk.parent_object_id = OBJECT_ID('dbo.Visits')
              AND EXISTS (
                  SELECT 1 FROM sys.foreign_key_columns fkc
                  INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
                  WHERE fkc.constraint_object_id = fk.object_id AND c.name = 'hostUserId'
              );
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        await queryRunner.query(`
            DECLARE @sql NVARCHAR(MAX) = '';
            SELECT @sql += 'DROP INDEX [' + i.name + '] ON [dbo].[Visits];'
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE i.object_id = OBJECT_ID('dbo.Visits') AND c.name = 'hostUserId' AND i.is_primary_key = 0;
            IF @sql <> '' EXEC sp_executesql @sql;
        `);

        await queryRunner.query(`
            IF COL_LENGTH('dbo.Visits', 'hostUserId') IS NOT NULL
                ALTER TABLE [dbo].[Visits] DROP COLUMN [hostUserId];
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add hostUserId to Visitors
        await queryRunner.query(`ALTER TABLE [dbo].[Visitors] ADD [hostUserId] UNIQUEIDENTIFIER NULL`);
        await queryRunner.query(`CREATE INDEX [IX_Visitors_HostUserId] ON [dbo].[Visitors] ([hostUserId])`);

        // Re-add hostUserId to Visits
        await queryRunner.query(`ALTER TABLE [dbo].[Visits] ADD [hostUserId] UNIQUEIDENTIFIER NULL`);
        await queryRunner.query(`CREATE INDEX [IX_Visits_hostUserId] ON [dbo].[Visits] ([hostUserId])`);
    }
}
