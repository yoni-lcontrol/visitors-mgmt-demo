import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeVisitorPersonIdRequired1775800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Fill any existing NULL personId values with empty string before adding NOT NULL constraint
        await queryRunner.query(`UPDATE "Visitors" SET "personId" = '' WHERE "personId" IS NULL`);
        await queryRunner.query(`ALTER TABLE "Visitors" ALTER COLUMN "personId" NVARCHAR(50) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Visitors" ALTER COLUMN "personId" NVARCHAR(50) NULL`);
    }
}
