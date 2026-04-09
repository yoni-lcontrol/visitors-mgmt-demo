import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeVisitorVisitDateNullable1775700000000 implements MigrationInterface {
    name = 'MakeVisitorVisitDateNullable1775700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [dbo].[Visitors] ALTER COLUMN [visitDate] DATE NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE [dbo].[Visitors] SET [visitDate] = CAST(GETDATE() AS DATE) WHERE [visitDate] IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE [dbo].[Visitors] ALTER COLUMN [visitDate] DATE NOT NULL`,
        );
    }
}
