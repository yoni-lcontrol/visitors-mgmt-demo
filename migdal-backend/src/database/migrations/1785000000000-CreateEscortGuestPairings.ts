import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEscortGuestPairings1785000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE [EscortGuestPairings] (
                [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [visitVisitorId] UNIQUEIDENTIFIER NOT NULL,
                [escortUserId] UNIQUEIDENTIFIER NOT NULL,
                [doorId] UNIQUEIDENTIFIER NOT NULL,
                [status] NVARCHAR(20) NOT NULL DEFAULT 'card_activated',
                [pairedAtUtc] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                [releasedAtUtc] DATETIME2 NULL,
                [createdAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                [updatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                [createdBy] UNIQUEIDENTIFIER NULL,
                [updatedBy] UNIQUEIDENTIFIER NULL,
                [isActive] BIT NOT NULL DEFAULT 1,
                CONSTRAINT [PK_EscortGuestPairings] PRIMARY KEY ([id]),
                CONSTRAINT [FK_EscortGuestPairings_visitVisitorId] FOREIGN KEY ([visitVisitorId]) REFERENCES [VisitVisitors]([id]) ON DELETE CASCADE,
                CONSTRAINT [FK_EscortGuestPairings_escortUserId] FOREIGN KEY ([escortUserId]) REFERENCES [Users]([id]) ON DELETE NO ACTION,
                CONSTRAINT [FK_EscortGuestPairings_doorId] FOREIGN KEY ([doorId]) REFERENCES [Doors]([id]) ON DELETE NO ACTION
            )
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_EscortGuestPairings_escortUserId_status] ON [EscortGuestPairings] ([escortUserId], [status])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE [EscortGuestPairings]`);
    }
}
