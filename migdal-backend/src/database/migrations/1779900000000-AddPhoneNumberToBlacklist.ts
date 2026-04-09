import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhoneNumberToBlacklist1779900000000 implements MigrationInterface {
    name = 'AddPhoneNumberToBlacklist1779900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Blacklist" ADD "phoneNumber" nvarchar(50) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Blacklist" DROP COLUMN "phoneNumber"`);
    }
}
