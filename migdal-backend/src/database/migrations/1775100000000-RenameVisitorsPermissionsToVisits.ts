import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameVisitorsPermissionsToVisits1775100000000 implements MigrationInterface {
    name = 'RenameVisitorsPermissionsToVisits1775100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update the permission key, name, description, and module from 'visitors' to 'visits'
        await queryRunner.query(`
            UPDATE "Permissions"
            SET "key"         = REPLACE("key", 'visitors.', 'visits.'),
                "name"        = REPLACE("name", 'Visitors', 'Visits'),
                "description" = REPLACE("description", 'visitor', 'visit'),
                "module"      = 'visits'
            WHERE "module" = 'visitors'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "Permissions"
            SET "key"         = REPLACE("key", 'visits.', 'visitors.'),
                "name"        = REPLACE("name", 'Visits', 'Visitors'),
                "description" = REPLACE("description", 'visit', 'visitor'),
                "module"      = 'visitors'
            WHERE "module" = 'visits'
        `);
    }
}
