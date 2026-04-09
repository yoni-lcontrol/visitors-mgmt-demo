import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVehicleBlacklist1779800000000 implements MigrationInterface {
    name = 'AddVehicleBlacklist1779800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add blacklistType column with default 'person' for existing rows
        await queryRunner.query(`ALTER TABLE "Blacklist" ADD "blacklistType" nvarchar(20) NOT NULL CONSTRAINT "DF_Blacklist_blacklistType" DEFAULT 'person'`);

        // Add carNumber column (nullable, used for vehicle blacklist entries)
        await queryRunner.query(`ALTER TABLE "Blacklist" ADD "carNumber" nvarchar(50) NULL`);

        // Make person-specific columns nullable (vehicle entries won't have these)
        await queryRunner.query(`ALTER TABLE "Blacklist" ALTER COLUMN "firstName" nvarchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE "Blacklist" ALTER COLUMN "lastName" nvarchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE "Blacklist" ALTER COLUMN "idNumber" nvarchar(50) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove vehicle entries before making columns NOT NULL again
        await queryRunner.query(`DELETE FROM "Blacklist" WHERE "blacklistType" = 'vehicle'`);

        // Restore NOT NULL constraints
        await queryRunner.query(`UPDATE "Blacklist" SET "firstName" = '' WHERE "firstName" IS NULL`);
        await queryRunner.query(`ALTER TABLE "Blacklist" ALTER COLUMN "firstName" nvarchar(100) NOT NULL`);
        await queryRunner.query(`UPDATE "Blacklist" SET "lastName" = '' WHERE "lastName" IS NULL`);
        await queryRunner.query(`ALTER TABLE "Blacklist" ALTER COLUMN "lastName" nvarchar(100) NOT NULL`);
        await queryRunner.query(`UPDATE "Blacklist" SET "idNumber" = '' WHERE "idNumber" IS NULL`);
        await queryRunner.query(`ALTER TABLE "Blacklist" ALTER COLUMN "idNumber" nvarchar(50) NOT NULL`);

        // Drop new columns
        await queryRunner.query(`ALTER TABLE "Blacklist" DROP CONSTRAINT "DF_Blacklist_blacklistType"`);
        await queryRunner.query(`ALTER TABLE "Blacklist" DROP COLUMN "carNumber"`);
        await queryRunner.query(`ALTER TABLE "Blacklist" DROP COLUMN "blacklistType"`);
    }
}
