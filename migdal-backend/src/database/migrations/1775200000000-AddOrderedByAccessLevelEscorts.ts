import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderedByAccessLevelEscorts1775200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add "Ordered By" columns to Visits
        await queryRunner.query(`
            ALTER TABLE [Visits]
                ADD [orderedByFirstName] NVARCHAR(200) NULL,
                    [orderedByLastName]  NVARCHAR(200) NULL,
                    [orderedByPhone]     NVARCHAR(50)  NULL,
                    [orderedByEmail]     NVARCHAR(320) NULL;
        `);

        // 2. Add accessLevelId to VisitVisitors
        await queryRunner.query(`
            ALTER TABLE [VisitVisitors]
                ADD [accessLevelId] UNIQUEIDENTIFIER NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE [VisitVisitors]
                ADD CONSTRAINT [FK_VisitVisitors_AccessLevel]
                    FOREIGN KEY ([accessLevelId]) REFERENCES [AccessLevels]([id])
                    ON DELETE NO ACTION;
        `);

        // 3. Create VisitVisitorEscorts table
        await queryRunner.query(`
            CREATE TABLE [VisitVisitorEscorts] (
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
                    FOREIGN KEY ([visitVisitorId]) REFERENCES [VisitVisitors]([id])
                    ON DELETE CASCADE
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE [VisitVisitorEscorts];`);

        await queryRunner.query(`
            ALTER TABLE [VisitVisitors] DROP CONSTRAINT [FK_VisitVisitors_AccessLevel];
        `);
        await queryRunner.query(`
            ALTER TABLE [VisitVisitors] DROP COLUMN [accessLevelId];
        `);

        await queryRunner.query(`
            ALTER TABLE [Visits]
                DROP COLUMN [orderedByFirstName],
                     [orderedByLastName],
                     [orderedByPhone],
                     [orderedByEmail];
        `);
    }
}
