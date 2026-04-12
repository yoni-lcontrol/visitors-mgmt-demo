import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailTemplatesWithTargetGroup1780500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE [EmailTemplates] (
                [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [event]       NVARCHAR(50)     NOT NULL,
                [targetGroup] NVARCHAR(50)     NOT NULL,
                [subject]     NVARCHAR(255)    NOT NULL,
                [bodyHtml]    NVARCHAR(MAX)    NOT NULL,
                [recipients]  NVARCHAR(MAX)    NULL,
                [isActive]    BIT              NOT NULL DEFAULT 1,
                [createdAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                [updatedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                [createdBy]   UNIQUEIDENTIFIER NULL,
                [updatedBy]   UNIQUEIDENTIFIER NULL,
                CONSTRAINT [PK_EmailTemplates] PRIMARY KEY ([id]),
                CONSTRAINT [UQ_EmailTemplates_event_targetGroup] UNIQUE ([event], [targetGroup])
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS [EmailTemplates]`);
    }
}
