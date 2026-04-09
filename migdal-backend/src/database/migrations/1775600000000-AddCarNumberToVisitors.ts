import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCarNumberToVisitors1775600000000 implements MigrationInterface {
    name = 'AddCarNumberToVisitors1775600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [dbo].[Visitors] ADD [carNumber] NVARCHAR(50) NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [dbo].[Visitors] DROP COLUMN [carNumber]`,
        );
    }
}
