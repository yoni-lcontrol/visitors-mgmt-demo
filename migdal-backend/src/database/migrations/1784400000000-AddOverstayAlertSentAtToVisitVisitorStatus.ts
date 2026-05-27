import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverstayAlertSentAtToVisitVisitorStatus1784400000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [VisitVisitorStatus]
            ADD [overstayAlertSentAtUtc] DATETIME2 NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [VisitVisitorStatus]
            DROP COLUMN [overstayAlertSentAtUtc]
        `);
    }
}
