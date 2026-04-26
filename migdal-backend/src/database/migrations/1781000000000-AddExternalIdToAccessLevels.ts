import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalIdToAccessLevels1781000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [AccessLevels] ADD [externalId] NVARCHAR(200) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [AccessLevels] DROP COLUMN [externalId]
        `);
    }
}
