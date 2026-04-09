import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVisitVisitorCheckInCodes1776900000000 implements MigrationInterface {
    name = 'AddVisitVisitorCheckInCodes1776900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── CREATE VisitVisitorCheckInCodes table ──
        await queryRunner.query(`
            CREATE TABLE "VisitVisitorCheckInCodes" (
                "id"              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                "visitVisitorId"  UNIQUEIDENTIFIER NOT NULL,
                "visitId"         UNIQUEIDENTIFIER NOT NULL,
                "visitorId"       UNIQUEIDENTIFIER NOT NULL,
                "code"            NVARCHAR(6)      NOT NULL,
                "validFromUtc"    DATETIME2        NOT NULL,
                "validToUtc"      DATETIME2        NOT NULL,
                "usedAtUtc"       DATETIME2        NULL,
                "sentBySms"       BIT              NOT NULL DEFAULT 0,
                "sentByEmail"     BIT              NOT NULL DEFAULT 0,
                "lastSentAtUtc"   DATETIME2        NULL,
                "isActive"        BIT              NOT NULL DEFAULT 1,
                "createdAt"       DATETIME2        NOT NULL DEFAULT GETDATE(),
                "updatedAt"       DATETIME2        NOT NULL DEFAULT GETDATE(),
                "createdBy"       UNIQUEIDENTIFIER NULL,
                "updatedBy"       UNIQUEIDENTIFIER NULL,
                CONSTRAINT "PK_VisitVisitorCheckInCodes" PRIMARY KEY ("id")
            )
        `);

        // ── Foreign Keys ──
        await queryRunner.query(`
            ALTER TABLE "VisitVisitorCheckInCodes"
            ADD CONSTRAINT "FK_VisitVisitorCheckInCodes_visitVisitorId"
            FOREIGN KEY ("visitVisitorId") REFERENCES "VisitVisitors"("id") ON DELETE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE "VisitVisitorCheckInCodes"
            ADD CONSTRAINT "FK_VisitVisitorCheckInCodes_visitId"
            FOREIGN KEY ("visitId") REFERENCES "Visits"("id") ON DELETE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "VisitVisitorCheckInCodes"
            ADD CONSTRAINT "FK_VisitVisitorCheckInCodes_visitorId"
            FOREIGN KEY ("visitorId") REFERENCES "Visitors"("id") ON DELETE NO ACTION
        `);

        // ── Indexes for efficient kiosk lookup ──
        // Composite index for kiosk validation: code + isActive + usedAtUtc + validity window
        await queryRunner.query(`
            CREATE INDEX "IX_VisitVisitorCheckInCodes_Code_Active"
            ON "VisitVisitorCheckInCodes" ("code", "isActive")
            INCLUDE ("usedAtUtc", "validFromUtc", "validToUtc")
        `);

        // Index for finding codes by visitVisitorId
        await queryRunner.query(`
            CREATE INDEX "IX_VisitVisitorCheckInCodes_VisitVisitorId"
            ON "VisitVisitorCheckInCodes" ("visitVisitorId")
        `);

        // Index for overlap check during code generation
        await queryRunner.query(`
            CREATE INDEX "IX_VisitVisitorCheckInCodes_Overlap"
            ON "VisitVisitorCheckInCodes" ("code", "isActive", "validFromUtc", "validToUtc")
            WHERE "usedAtUtc" IS NULL AND "isActive" = 1
        `);

        // ── New permissions for check-in codes ──
        await queryRunner.query(`
            INSERT INTO "Permissions" ("id", "key", "name", "description", "module", "action", "isActive", "createdAt", "updatedAt")
            VALUES
                (NEWID(), 'visits.check-in-code.send',       'Send Check-In Code',       'Send/resend check-in code to visitor',           'visits', 'check-in-code.send',       1, GETDATE(), GETDATE()),
                (NEWID(), 'visits.check-in-code.regenerate', 'Regenerate Check-In Code', 'Regenerate check-in code for visitor',           'visits', 'check-in-code.regenerate', 1, GETDATE(), GETDATE()),
                (NEWID(), 'visits.kiosk.check-in',           'Kiosk Check-In',           'Allow kiosk self-check-in via code',             'visits', 'kiosk.check-in',           1, GETDATE(), GETDATE())
        `);

        // ── Assign new permissions to Admin role ──
        await queryRunner.query(`
            INSERT INTO "RolePermissions" ("roleId", "permissionId")
            SELECT r."id", p."id"
            FROM "Roles" r
            CROSS JOIN "Permissions" p
            WHERE r."name" = 'Admin'
            AND p."key" IN ('visits.check-in-code.send', 'visits.check-in-code.regenerate', 'visits.kiosk.check-in')
        `);

        // ── Assign check-in code send/regenerate to Operator role ──
        await queryRunner.query(`
            INSERT INTO "RolePermissions" ("roleId", "permissionId")
            SELECT r."id", p."id"
            FROM "Roles" r
            CROSS JOIN "Permissions" p
            WHERE r."name" = 'Operator'
            AND p."key" IN ('visits.check-in-code.send', 'visits.check-in-code.regenerate', 'visits.kiosk.check-in')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ── Remove role-permission assignments ──
        await queryRunner.query(`
            DELETE rp FROM "RolePermissions" rp
            INNER JOIN "Permissions" p ON rp."permissionId" = p."id"
            WHERE p."key" IN ('visits.check-in-code.send', 'visits.check-in-code.regenerate', 'visits.kiosk.check-in')
        `);

        // ── Remove permissions ──
        await queryRunner.query(`
            DELETE FROM "Permissions"
            WHERE "key" IN ('visits.check-in-code.send', 'visits.check-in-code.regenerate', 'visits.kiosk.check-in')
        `);

        // ── Drop table ──
        await queryRunner.query(`DROP TABLE "VisitVisitorCheckInCodes"`);
    }
}
