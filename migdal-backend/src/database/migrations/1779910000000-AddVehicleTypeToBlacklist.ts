import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVehicleTypeToBlacklist1779910000000 implements MigrationInterface {
    name = 'AddVehicleTypeToBlacklist1779910000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Blacklist" ADD "vehicleType" nvarchar(20) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Blacklist" DROP COLUMN "vehicleType"`);
    }
}
