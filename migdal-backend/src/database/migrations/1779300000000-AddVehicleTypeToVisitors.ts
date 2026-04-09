import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleTypeToVisitors1779300000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'Visitors' AND COLUMN_NAME = 'vehicleType'
            )
            ALTER TABLE [Visitors] ADD [vehicleType] NVARCHAR(20) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Visitors] DROP COLUMN [vehicleType]`);
    }
}
