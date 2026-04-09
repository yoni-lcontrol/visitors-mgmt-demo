import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParkingRequests1780000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE [ParkingRequests] (
                [id]               uniqueidentifier NOT NULL CONSTRAINT [DF_ParkingRequests_id] DEFAULT NEWSEQUENTIALID(),
                [visitVisitorId]   uniqueidentifier NOT NULL,
                [status]           nvarchar(20)     NOT NULL CONSTRAINT [DF_ParkingRequests_status] DEFAULT 'pending',
                [reviewedByUserId] uniqueidentifier NULL,
                [reviewedAt]       datetime2        NULL,
                [reviewNote]       nvarchar(500)    NULL,
                [createdAt]        datetime2        NOT NULL CONSTRAINT [DF_ParkingRequests_createdAt] DEFAULT GETUTCDATE(),
                [updatedAt]        datetime2        NOT NULL CONSTRAINT [DF_ParkingRequests_updatedAt] DEFAULT GETUTCDATE(),
                [createdBy]        uniqueidentifier NULL,
                [updatedBy]        uniqueidentifier NULL,
                [isActive]         bit              NOT NULL CONSTRAINT [DF_ParkingRequests_isActive] DEFAULT 1,
                CONSTRAINT [PK_ParkingRequests] PRIMARY KEY ([id])
            )
        `);

        await queryRunner.query(`
            ALTER TABLE [ParkingRequests]
                ADD CONSTRAINT [FK_ParkingRequests_VisitVisitors]
                FOREIGN KEY ([visitVisitorId]) REFERENCES [VisitVisitors]([id])
                ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE [ParkingRequests]
                ADD CONSTRAINT [FK_ParkingRequests_Users]
                FOREIGN KEY ([reviewedByUserId]) REFERENCES [Users]([id])
                ON DELETE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [ParkingRequests] DROP CONSTRAINT [FK_ParkingRequests_Users]`);
        await queryRunner.query(`ALTER TABLE [ParkingRequests] DROP CONSTRAINT [FK_ParkingRequests_VisitVisitors]`);
        await queryRunner.query(`DROP TABLE [ParkingRequests]`);
    }
}
