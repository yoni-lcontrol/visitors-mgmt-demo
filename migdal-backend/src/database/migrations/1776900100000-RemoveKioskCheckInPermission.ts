import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveKioskCheckInPermission1776900100000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove role-permission assignments first
        await queryRunner.query(`
            DELETE rp FROM "RolePermissions" rp
            INNER JOIN "Permissions" p ON rp."permissionId" = p."id"
            WHERE p."key" = 'visits.kiosk.check-in'
        `);

        // Remove the permission itself
        await queryRunner.query(`
            DELETE FROM "Permissions" WHERE "key" = 'visits.kiosk.check-in'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-insert the permission
        await queryRunner.query(`
            INSERT INTO "Permissions" ("id", "key", "name", "description", "module", "action", "isActive", "createdAt", "updatedAt")
            VALUES (NEWID(), 'visits.kiosk.check-in', 'Kiosk Check-In', 'Allow kiosk self-check-in via code', 'visits', 'kiosk.check-in', 1, GETDATE(), GETDATE())
        `);
    }
}
