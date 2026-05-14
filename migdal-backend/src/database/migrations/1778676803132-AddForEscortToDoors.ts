import { MigrationInterface, QueryRunner } from "typeorm";

export class AddForEscortToDoors1778676803132 implements MigrationInterface {
    name = 'AddForEscortToDoors1778676803132'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Doors" ADD "forEscort" bit NOT NULL CONSTRAINT "DF_Doors_forEscort" DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Doors" DROP CONSTRAINT "DF_Doors_forEscort"`);
        await queryRunner.query(`ALTER TABLE "Doors" DROP COLUMN "forEscort"`);
    }
}
