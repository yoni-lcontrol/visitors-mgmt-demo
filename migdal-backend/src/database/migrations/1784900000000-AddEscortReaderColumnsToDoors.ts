import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEscortReaderColumnsToDoors1784900000000 implements MigrationInterface {
    name = 'AddEscortReaderColumnsToDoors1784900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Doors" ADD "badgeReaderExternalId" nvarchar(200) NULL`);
        await queryRunner.query(`ALTER TABLE "Doors" ADD "qrReaderExternalId" nvarchar(200) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "qrReaderExternalId"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "badgeReaderExternalId"`);
    }
}
