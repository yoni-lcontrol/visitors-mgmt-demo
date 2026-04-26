import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEntraTenantAndDisplayNameToUsers1781800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [Users]
                ADD [externalTenantId] nvarchar(100) NULL,
                    [displayName] nvarchar(200) NULL
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_Users_externalTenantId] ON [Users]([externalTenantId])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX [IX_Users_externalTenantId] ON [Users]`);

        await queryRunner.query(`
            ALTER TABLE [Users]
                DROP COLUMN [externalTenantId],
                     [displayName]
        `);
    }
}
