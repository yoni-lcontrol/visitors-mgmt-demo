import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFloorToVisits1779000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Visits] ADD [floor] int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Visits] DROP COLUMN [floor]`);
    }
}
