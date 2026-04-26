import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSectionsAndUserSectionId1780900000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Sections table
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

        // Add sectionId FK column to Users
        await queryRunner.query(`
            ALTER TABLE [Users] ADD [sectionId] UNIQUEIDENTIFIER NULL
        `);

        await queryRunner.query(`
            ALTER TABLE [Users]
            ADD CONSTRAINT [FK_Users_Sections] FOREIGN KEY ([sectionId]) REFERENCES [Sections]([id])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Users] DROP CONSTRAINT [FK_Users_Sections]`);
        await queryRunner.query(`ALTER TABLE [Users] DROP COLUMN [sectionId]`);
        await queryRunner.query(`DROP TABLE [Sections]`);
    }
}
