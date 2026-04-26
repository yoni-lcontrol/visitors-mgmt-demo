import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSectorsAndUserSectorId1780700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Sectors table
        await queryRunner.query(`
            CREATE TABLE [Sectors] (
                [id]        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [name]      NVARCHAR(200)    NOT NULL,
                [isActive]  BIT              NOT NULL DEFAULT 1,
                [createdAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                [updatedAt] DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                [createdBy] UNIQUEIDENTIFIER NULL,
                [updatedBy] UNIQUEIDENTIFIER NULL,
                CONSTRAINT [PK_Sectors] PRIMARY KEY ([id]),
                CONSTRAINT [UQ_Sectors_name] UNIQUE ([name])
            )
        `);

        // Add sectorId FK column to Users
        await queryRunner.query(`
            ALTER TABLE [Users] ADD [sectorId] UNIQUEIDENTIFIER NULL
        `);

        await queryRunner.query(`
            ALTER TABLE [Users]
            ADD CONSTRAINT [FK_Users_Sectors] FOREIGN KEY ([sectorId]) REFERENCES [Sectors]([id])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Users] DROP CONSTRAINT [FK_Users_Sectors]`);
        await queryRunner.query(`ALTER TABLE [Users] DROP COLUMN [sectorId]`);
        await queryRunner.query(`DROP TABLE [Sectors]`);
    }
}
