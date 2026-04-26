import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSectionsAndUserSectionId1781000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure section names exist in Sectors before dropping Sections.
        if (await queryRunner.hasTable('Sections') && await queryRunner.hasTable('Sectors')) {
            await queryRunner.query(`
                INSERT INTO [Sectors] ([name], [isActive], [createdAt], [updatedAt], [createdBy], [updatedBy])
                SELECT [sec].[name], [sec].[isActive], GETUTCDATE(), GETUTCDATE(), NULL, NULL
                FROM [Sections] [sec]
                LEFT JOIN [Sectors] [s] ON [s].[name] = [sec].[name]
                WHERE [s].[id] IS NULL
            `);

            await queryRunner.query(`
                UPDATE [u]
                SET [u].[sectorId] = [s].[id]
                FROM [Users] [u]
                INNER JOIN [Sections] [sec] ON [u].[sectionId] = [sec].[id]
                INNER JOIN [Sectors] [s] ON [s].[name] = [sec].[name]
                WHERE [u].[sectionId] IS NOT NULL
                  AND [u].[sectorId] IS NULL
            `);
        }

        const hasUsersTable = await queryRunner.hasTable('Users');
        if (hasUsersTable) {
            await queryRunner.query(`
                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Users_Sections')
                    ALTER TABLE [Users] DROP CONSTRAINT [FK_Users_Sections]
            `);

            await queryRunner.query(`
                IF COL_LENGTH('Users', 'sectionId') IS NOT NULL
                    ALTER TABLE [Users] DROP COLUMN [sectionId]
            `);
        }

        if (await queryRunner.hasTable('Sections')) {
            await queryRunner.query(`DROP TABLE [Sections]`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('Sections')) {
            await queryRunner.query(`
                CREATE TABLE [Sections] (
                    [id]        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                    [name]      NVARCHAR(200)    NOT NULL,
                    [isActive]  BIT              NOT NULL DEFAULT 1,
                    [createdAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                    [updatedAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                    [createdBy] UNIQUEIDENTIFIER NULL,
                    [updatedBy] UNIQUEIDENTIFIER NULL,
                    CONSTRAINT [PK_Sections] PRIMARY KEY ([id]),
                    CONSTRAINT [UQ_Sections_name] UNIQUE ([name])
                )
            `);
        }

        if (await queryRunner.hasTable('Sectors')) {
            await queryRunner.query(`
                INSERT INTO [Sections] ([name], [isActive], [createdAt], [updatedAt], [createdBy], [updatedBy])
                SELECT [s].[name], [s].[isActive], GETUTCDATE(), GETUTCDATE(), NULL, NULL
                FROM [Sectors] [s]
                LEFT JOIN [Sections] [sec] ON [sec].[name] = [s].[name]
                WHERE [sec].[id] IS NULL
            `);
        }

        const hasUsersTable = await queryRunner.hasTable('Users');
        if (hasUsersTable) {
            await queryRunner.query(`
                IF COL_LENGTH('Users', 'sectionId') IS NULL
                    ALTER TABLE [Users] ADD [sectionId] UNIQUEIDENTIFIER NULL
            `);

            if (await queryRunner.hasTable('Sectors')) {
                await queryRunner.query(`
                    UPDATE [u]
                    SET [u].[sectionId] = [sec].[id]
                    FROM [Users] [u]
                    INNER JOIN [Sectors] [s] ON [u].[sectorId] = [s].[id]
                    INNER JOIN [Sections] [sec] ON [sec].[name] = [s].[name]
                    WHERE [u].[sectorId] IS NOT NULL
                      AND [u].[sectionId] IS NULL
                `);
            }

            await queryRunner.query(`
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Users_Sections')
                    ALTER TABLE [Users]
                    ADD CONSTRAINT [FK_Users_Sections] FOREIGN KEY ([sectionId]) REFERENCES [Sections]([id])
            `);
        }
    }
}