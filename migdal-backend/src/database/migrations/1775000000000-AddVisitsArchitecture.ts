import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVisitsArchitecture1775000000000 implements MigrationInterface {
    name = 'AddVisitsArchitecture1775000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── ALTER Visitors: add missing columns ──
        await queryRunner.query(`ALTER TABLE "Visitors" ADD "fullName" NVARCHAR(200) NULL`);
        await queryRunner.query(`ALTER TABLE "Visitors" ADD "personId" NVARCHAR(50) NULL`);

        // Back-fill fullName from existing data
        await queryRunner.query(`UPDATE "Visitors" SET "fullName" = CONCAT("firstName", ' ', "lastName") WHERE "fullName" IS NULL`);

        // ── CREATE Visits table ──
        await queryRunner.query(`
            CREATE TABLE "Visits" (
                "id"                   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                "siteId"               NVARCHAR(100)    NULL,
                "hostUserId"           UNIQUEIDENTIFIER NOT NULL,
                "title"                NVARCHAR(300)    NOT NULL,
                "description"          NVARCHAR(2000)   NULL,
                "plannedStartTimeUtc"  DATETIME2        NOT NULL,
                "plannedEndTimeUtc"    DATETIME2        NULL,
                "createdByUserId"      UNIQUEIDENTIFIER NULL,
                "isActive"             BIT              NOT NULL DEFAULT 1,
                "createdAt"            DATETIME2        NOT NULL DEFAULT GETDATE(),
                "updatedAt"            DATETIME2        NOT NULL DEFAULT GETDATE(),
                "createdBy"            UNIQUEIDENTIFIER NULL,
                "updatedBy"            UNIQUEIDENTIFIER NULL,
                CONSTRAINT "PK_Visits" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`ALTER TABLE "Visits" ADD CONSTRAINT "FK_Visits_hostUserId" FOREIGN KEY ("hostUserId") REFERENCES "Users"("id") ON DELETE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "IX_Visits_hostUserId" ON "Visits" ("hostUserId")`);
        await queryRunner.query(`CREATE INDEX "IX_Visits_plannedStartTimeUtc" ON "Visits" ("plannedStartTimeUtc" DESC)`);

        // ── CREATE VisitVisitors bridge table ──
        await queryRunner.query(`
            CREATE TABLE "VisitVisitors" (
                "id"          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                "visitId"     UNIQUEIDENTIFIER NOT NULL,
                "visitorId"   UNIQUEIDENTIFIER NOT NULL,
                "notes"       NVARCHAR(1000)   NULL,
                "isActive"    BIT              NOT NULL DEFAULT 1,
                "createdAt"   DATETIME2        NOT NULL DEFAULT GETDATE(),
                "updatedAt"   DATETIME2        NOT NULL DEFAULT GETDATE(),
                "createdBy"   UNIQUEIDENTIFIER NULL,
                "updatedBy"   UNIQUEIDENTIFIER NULL,
                CONSTRAINT "PK_VisitVisitors" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_VisitVisitors_visit_visitor" UNIQUE ("visitId", "visitorId")
            )
        `);

        await queryRunner.query(`ALTER TABLE "VisitVisitors" ADD CONSTRAINT "FK_VisitVisitors_visitId" FOREIGN KEY ("visitId") REFERENCES "Visits"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "VisitVisitors" ADD CONSTRAINT "FK_VisitVisitors_visitorId" FOREIGN KEY ("visitorId") REFERENCES "Visitors"("id") ON DELETE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "IX_VisitVisitors_visitId" ON "VisitVisitors" ("visitId")`);
        await queryRunner.query(`CREATE INDEX "IX_VisitVisitors_visitorId" ON "VisitVisitors" ("visitorId")`);

        // ── CREATE VisitorAccessLogs history table (BIGINT PK for perf) ──
        await queryRunner.query(`
            CREATE TABLE "VisitorAccessLogs" (
                "logId"            BIGINT IDENTITY(1,1) NOT NULL,
                "visitVisitorId"   UNIQUEIDENTIFIER NOT NULL,
                "visitId"          UNIQUEIDENTIFIER NOT NULL,
                "visitorId"        UNIQUEIDENTIFIER NOT NULL,
                "siteId"           NVARCHAR(100)    NULL,
                "eventType"        INT              NOT NULL,
                "eventTimeUtc"     DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                "deviceId"         NVARCHAR(100)    NULL,
                "gateId"           NVARCHAR(100)    NULL,
                "readerId"         NVARCHAR(100)    NULL,
                "source"           NVARCHAR(50)     NULL,
                "createdByUserId"  UNIQUEIDENTIFIER NULL,
                "notes"            NVARCHAR(1000)   NULL,
                "createdAt"        DATETIME2        NOT NULL DEFAULT GETDATE(),
                CONSTRAINT "PK_VisitorAccessLogs" PRIMARY KEY CLUSTERED ("logId")
            )
        `);

        await queryRunner.query(`ALTER TABLE "VisitorAccessLogs" ADD CONSTRAINT "FK_VisitorAccessLogs_visitVisitorId" FOREIGN KEY ("visitVisitorId") REFERENCES "VisitVisitors"("id") ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "VisitorAccessLogs" ADD CONSTRAINT "FK_VisitorAccessLogs_visitId" FOREIGN KEY ("visitId") REFERENCES "Visits"("id") ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "VisitorAccessLogs" ADD CONSTRAINT "FK_VisitorAccessLogs_visitorId" FOREIGN KEY ("visitorId") REFERENCES "Visitors"("id") ON DELETE NO ACTION`);

        // Performance indexes
        await queryRunner.query(`CREATE NONCLUSTERED INDEX "IX_VisitorAccessLogs_visitVisitorId_eventTime" ON "VisitorAccessLogs" ("visitVisitorId", "eventTimeUtc" DESC)`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX "IX_VisitorAccessLogs_visitId_eventTime" ON "VisitorAccessLogs" ("visitId", "eventTimeUtc" DESC)`);
        await queryRunner.query(`CREATE NONCLUSTERED INDEX "IX_VisitorAccessLogs_visitorId_eventTime" ON "VisitorAccessLogs" ("visitorId", "eventTimeUtc" DESC)`);

        // ── CREATE VisitVisitorStatus (1:1 with VisitVisitors) ──
        await queryRunner.query(`
            CREATE TABLE "VisitVisitorStatus" (
                "visitVisitorId"   UNIQUEIDENTIFIER NOT NULL,
                "visitId"          UNIQUEIDENTIFIER NOT NULL,
                "visitorId"        UNIQUEIDENTIFIER NOT NULL,
                "currentStatus"    INT              NOT NULL DEFAULT 0,
                "lastAccessLogId"  BIGINT           NULL,
                "lastEventTimeUtc" DATETIME2        NULL,
                "arrivedAtUtc"     DATETIME2        NULL,
                "checkedInAtUtc"   DATETIME2        NULL,
                "checkedOutAtUtc"  DATETIME2        NULL,
                "updatedAt"        DATETIME2        NOT NULL DEFAULT GETDATE(),
                CONSTRAINT "PK_VisitVisitorStatus" PRIMARY KEY ("visitVisitorId")
            )
        `);

        await queryRunner.query(`ALTER TABLE "VisitVisitorStatus" ADD CONSTRAINT "FK_VisitVisitorStatus_visitVisitorId" FOREIGN KEY ("visitVisitorId") REFERENCES "VisitVisitors"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "VisitVisitorStatus" ADD CONSTRAINT "FK_VisitVisitorStatus_visitId" FOREIGN KEY ("visitId") REFERENCES "Visits"("id") ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "VisitVisitorStatus" ADD CONSTRAINT "FK_VisitVisitorStatus_visitorId" FOREIGN KEY ("visitorId") REFERENCES "Visitors"("id") ON DELETE NO ACTION`);

        await queryRunner.query(`CREATE INDEX "IX_VisitVisitorStatus_visitId" ON "VisitVisitorStatus" ("visitId")`);
        await queryRunner.query(`CREATE INDEX "IX_VisitVisitorStatus_visitorId" ON "VisitVisitorStatus" ("visitorId")`);
        await queryRunner.query(`CREATE INDEX "IX_VisitVisitorStatus_currentStatus" ON "VisitVisitorStatus" ("currentStatus")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "VisitVisitorStatus"`);
        await queryRunner.query(`DROP TABLE "VisitorAccessLogs"`);
        await queryRunner.query(`DROP TABLE "VisitVisitors"`);
        await queryRunner.query(`DROP TABLE "Visits"`);

        await queryRunner.query(`ALTER TABLE "Visitors" DROP COLUMN "personId"`);
        await queryRunner.query(`ALTER TABLE "Visitors" DROP COLUMN "fullName"`);
    }
}
