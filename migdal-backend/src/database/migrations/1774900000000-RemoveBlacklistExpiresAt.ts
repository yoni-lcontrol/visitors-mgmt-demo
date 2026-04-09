import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveBlacklistExpiresAt1774900000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Blacklist] DROP COLUMN [expiresAt]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Blacklist] ADD [expiresAt] DATETIME2 NULL`);
    }
}
