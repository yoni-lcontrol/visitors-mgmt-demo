import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVisitFiles1784300000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE [VisitFiles] (
                [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [visitId] UNIQUEIDENTIFIER NOT NULL,
                [originalName] NVARCHAR(500) NOT NULL,
                [storedPath] NVARCHAR(500) NOT NULL,
                [mimeType] NVARCHAR(100) NOT NULL,
                [size] INT NOT NULL,
                [createdAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                [updatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                [createdBy] UNIQUEIDENTIFIER NULL,
                [updatedBy] UNIQUEIDENTIFIER NULL,
                [isActive] BIT NOT NULL DEFAULT 1,
                CONSTRAINT [PK_VisitFiles] PRIMARY KEY ([id]),
                CONSTRAINT [FK_VisitFiles_visitId] FOREIGN KEY ([visitId]) REFERENCES [Visits]([id]) ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_VisitFiles_visitId] ON [VisitFiles] ([visitId]) WHERE [isActive] = 1
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX [IX_VisitFiles_visitId] ON [VisitFiles]`);
        await queryRunner.query(`DROP TABLE [VisitFiles]`);
    }
}
