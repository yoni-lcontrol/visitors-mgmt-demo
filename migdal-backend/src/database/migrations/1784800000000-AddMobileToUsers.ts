import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMobileToUsers1784800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Users] ADD [mobile] nvarchar(50) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Users] DROP COLUMN [mobile]`);
    }
}
