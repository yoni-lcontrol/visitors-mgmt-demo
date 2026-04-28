import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenVehicleTypeColumn1782200000000 implements MigrationInterface {
    name = 'WidenVehicleTypeColumn1782200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [Visitors] ALTER COLUMN [vehicleType] NVARCHAR(250) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE [Blacklist] ALTER COLUMN [vehicleType] NVARCHAR(250) NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [Blacklist] ALTER COLUMN [vehicleType] NVARCHAR(20) NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE [Visitors] ALTER COLUMN [vehicleType] NVARCHAR(20) NULL
        `);
    }
}
