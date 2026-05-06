import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNucleusToVisits1783300000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [Visits] ADD [nucleus] NVARCHAR(100) NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [Visits] DROP COLUMN [nucleus]`,
        );
    }
}
