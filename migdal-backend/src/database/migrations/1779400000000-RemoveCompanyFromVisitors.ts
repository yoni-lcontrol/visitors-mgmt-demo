import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCompanyFromVisitors1779400000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Visitors] DROP COLUMN [company]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Visitors] ADD [company] NVARCHAR(200) NULL`);
    }
}
