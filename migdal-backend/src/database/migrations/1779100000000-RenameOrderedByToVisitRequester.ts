import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameOrderedByToVisitRequester1779100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Rename orderedBy columns on Visits table
        await queryRunner.query(`EXEC sp_rename 'Visits.orderedByFirstName', 'visitRequesterFirstName', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'Visits.orderedByLastName', 'visitRequesterLastName', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'Visits.orderedByPhone', 'visitRequesterPhone', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'Visits.orderedByEmail', 'visitRequesterEmail', 'COLUMN'`);

        // Update notification target group
        await queryRunner.query(`UPDATE NotificationSettings SET targetGroup = 'visit_requester' WHERE targetGroup = 'ordered_by'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`EXEC sp_rename 'Visits.visitRequesterFirstName', 'orderedByFirstName', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'Visits.visitRequesterLastName', 'orderedByLastName', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'Visits.visitRequesterPhone', 'orderedByPhone', 'COLUMN'`);
        await queryRunner.query(`EXEC sp_rename 'Visits.visitRequesterEmail', 'orderedByEmail', 'COLUMN'`);

        await queryRunner.query(`UPDATE NotificationSettings SET targetGroup = 'ordered_by' WHERE targetGroup = 'visit_requester'`);
    }
}
