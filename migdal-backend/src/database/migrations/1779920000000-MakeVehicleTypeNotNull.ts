import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeVehicleTypeNotNull1779920000000
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE [Blacklist] SET [vehicleType] = '' WHERE [vehicleType] IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE [Blacklist] ALTER COLUMN [vehicleType] nvarchar(20) NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE [Blacklist] ADD CONSTRAINT [DF_Blacklist_vehicleType] DEFAULT '' FOR [vehicleType]`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [Blacklist] DROP CONSTRAINT [DF_Blacklist_vehicleType]`,
        );
        await queryRunner.query(
            `ALTER TABLE [Blacklist] ALTER COLUMN [vehicleType] nvarchar(20) NULL`,
        );
    }
}
