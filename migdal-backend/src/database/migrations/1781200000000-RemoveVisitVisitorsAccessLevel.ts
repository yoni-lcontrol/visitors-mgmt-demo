import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveVisitVisitorsAccessLevel1781200000000 implements MigrationInterface {
    name = 'RemoveVisitVisitorsAccessLevel1781200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF EXISTS (
                SELECT 1
                FROM sys.foreign_keys
                WHERE name = 'FK_VisitVisitors_AccessLevel'
            )
            BEGIN
                ALTER TABLE [VisitVisitors] DROP CONSTRAINT [FK_VisitVisitors_AccessLevel];
            END
        `);

        await queryRunner.query(`
            IF EXISTS (
                SELECT 1
                FROM sys.foreign_keys
                WHERE name = 'FK_VisitVisitors_accessLevelId'
            )
            BEGIN
                ALTER TABLE [VisitVisitors] DROP CONSTRAINT [FK_VisitVisitors_accessLevelId];
            END
        `);

        await queryRunner.query(`
            IF EXISTS (
                SELECT 1
                FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[VisitVisitors]')
                  AND name = 'accessLevelId'
            )
            BEGIN
                ALTER TABLE [VisitVisitors] DROP COLUMN [accessLevelId];
            END
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF NOT EXISTS (
                SELECT 1
                FROM sys.columns
                WHERE object_id = OBJECT_ID(N'[VisitVisitors]')
                  AND name = 'accessLevelId'
            )
            BEGIN
                ALTER TABLE [VisitVisitors]
                ADD [accessLevelId] UNIQUEIDENTIFIER NULL;
            END
        `);

        await queryRunner.query(`
            IF NOT EXISTS (
                SELECT 1
                FROM sys.foreign_keys
                WHERE name = 'FK_VisitVisitors_AccessLevel'
            )
            BEGIN
                ALTER TABLE [VisitVisitors]
                ADD CONSTRAINT [FK_VisitVisitors_AccessLevel]
                FOREIGN KEY ([accessLevelId]) REFERENCES [AccessLevels]([id])
                ON DELETE NO ACTION;
            END
        `);
    }
}
