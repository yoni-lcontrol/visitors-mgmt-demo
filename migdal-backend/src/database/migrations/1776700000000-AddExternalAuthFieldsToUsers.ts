import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalAuthFieldsToUsers1776700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [Users]
                ADD [externalAuthProvider] nvarchar(50) NULL,
                    [externalAuthId] nvarchar(255) NULL,
                    [lastExternalLoginAt] datetime2 NULL
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_Users_externalAuthId] ON [Users]([externalAuthId])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX [IX_Users_externalAuthId] ON [Users]`);

        await queryRunner.query(`
            ALTER TABLE [Users]
                DROP COLUMN [externalAuthProvider],
                     [externalAuthId],
                     [lastExternalLoginAt]
        `);
    }
}
