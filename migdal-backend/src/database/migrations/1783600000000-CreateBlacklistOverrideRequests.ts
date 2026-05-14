import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlacklistOverrideRequests1783600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE [BlacklistOverrideRequests] (
                [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [visitVisitorId] UNIQUEIDENTIFIER NOT NULL,
                [blacklistId] UNIQUEIDENTIFIER NULL,
                [blacklistReason] NVARCHAR(500) NULL,
                [status] NVARCHAR(20) NOT NULL DEFAULT 'pending',
                [reviewedByUserId] UNIQUEIDENTIFIER NULL,
                [reviewedAt] DATETIME2 NULL,
                [reviewNote] NVARCHAR(500) NULL,
                [createdAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                [updatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                [createdBy] UNIQUEIDENTIFIER NULL,
                [updatedBy] UNIQUEIDENTIFIER NULL,
                [isActive] BIT NOT NULL DEFAULT 1,
                CONSTRAINT [PK_BlacklistOverrideRequests] PRIMARY KEY ([id]),
                CONSTRAINT [FK_BlacklistOverrideRequests_visitVisitorId] FOREIGN KEY ([visitVisitorId]) REFERENCES [VisitVisitors]([id]) ON DELETE CASCADE,
                CONSTRAINT [FK_BlacklistOverrideRequests_reviewedByUserId] FOREIGN KEY ([reviewedByUserId]) REFERENCES [Users]([id]) ON DELETE NO ACTION
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE [BlacklistOverrideRequests]`);
    }
}
