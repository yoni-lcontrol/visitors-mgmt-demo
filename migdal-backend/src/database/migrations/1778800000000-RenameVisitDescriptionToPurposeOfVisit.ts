import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameVisitDescriptionToPurposeOfVisit1778800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            EXEC sp_rename 'Visits.description', 'purposeOfVisit', 'COLUMN'
        `);

        // Update any existing SMS templates that use the old placeholder
        await queryRunner.query(`
            UPDATE [Settings]
            SET [value] = REPLACE([value], '{{visit.description}}', '{{visit.purposeOfVisit}}')
            WHERE [value] LIKE '%{{visit.description}}%'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            EXEC sp_rename 'Visits.purposeOfVisit', 'description', 'COLUMN'
        `);

        await queryRunner.query(`
            UPDATE [Settings]
            SET [value] = REPLACE([value], '{{visit.purposeOfVisit}}', '{{visit.description}}')
            WHERE [value] LIKE '%{{visit.purposeOfVisit}}%'
        `);
    }
}
