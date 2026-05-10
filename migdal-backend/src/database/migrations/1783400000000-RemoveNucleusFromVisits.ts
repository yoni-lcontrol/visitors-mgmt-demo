import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveNucleusFromVisits1783400000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [Visits] DROP COLUMN [nucleus]`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [Visits] ADD [nucleus] NVARCHAR(100) NULL`,
        );
    }
}
