import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLicensePlateToUsers1746700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [Users] ADD [licensePlate] NVARCHAR(20) NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [Users] DROP COLUMN [licensePlate]`,
        );
    }
}
