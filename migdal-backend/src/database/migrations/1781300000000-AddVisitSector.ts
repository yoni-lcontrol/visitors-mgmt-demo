import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVisitSector1781300000000 implements MigrationInterface {
    name = 'AddVisitSector1781300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF COL_LENGTH('Visits', 'sectorId') IS NULL
            BEGIN
                ALTER TABLE "Visits" ADD "sectorId" UNIQUEIDENTIFIER NULL
            END
        `);

        await queryRunner.query(`
            IF NOT EXISTS (
                SELECT 1
                FROM sys.foreign_keys
                WHERE name = 'FK_Visits_sectorId'
            )
            BEGIN
                ALTER TABLE "Visits"
                ADD CONSTRAINT "FK_Visits_sectorId"
                FOREIGN KEY ("sectorId") REFERENCES "Sectors"("id")
            END
        `);

        await queryRunner.query(`
            IF NOT EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE name = 'IX_Visits_sectorId'
                  AND object_id = OBJECT_ID('Visits')
            )
            BEGIN
                CREATE INDEX "IX_Visits_sectorId" ON "Visits" ("sectorId")
            END
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE name = 'IX_Visits_sectorId'
                  AND object_id = OBJECT_ID('Visits')
            )
            BEGIN
                DROP INDEX "IX_Visits_sectorId" ON "Visits"
            END
        `);

        await queryRunner.query(`
            IF EXISTS (
                SELECT 1
                FROM sys.foreign_keys
                WHERE name = 'FK_Visits_sectorId'
            )
            BEGIN
                ALTER TABLE "Visits" DROP CONSTRAINT "FK_Visits_sectorId"
            END
        `);

        await queryRunner.query(`
            IF COL_LENGTH('Visits', 'sectorId') IS NOT NULL
            BEGIN
                ALTER TABLE "Visits" DROP COLUMN "sectorId"
            END
        `);
    }
}