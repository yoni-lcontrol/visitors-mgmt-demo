import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalEventLogs1777000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "ExternalEventLogs" (
                "id" uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
                "provider" nvarchar(50) NOT NULL,
                "clientId" nvarchar(100) NOT NULL,
                "externalEventId" nvarchar(255) NULL,
                "eventType" nvarchar(100) NOT NULL,
                "payloadJson" nvarchar(MAX) NOT NULL,
                "signature" nvarchar(512) NOT NULL,
                "receivedAt" datetime2 NOT NULL,
                "processedAt" datetime2 NULL,
                "status" nvarchar(20) NOT NULL DEFAULT 'received',
                "errorMessage" nvarchar(2000) NULL,
                "correlationId" nvarchar(255) NULL,
                "createdAt" datetime2 NOT NULL DEFAULT GETDATE(),
                "updatedAt" datetime2 NOT NULL DEFAULT GETDATE(),
                "createdBy" uniqueidentifier NULL,
                "updatedBy" uniqueidentifier NULL,
                "isActive" bit NOT NULL DEFAULT 1,
                CONSTRAINT "PK_ExternalEventLogs" PRIMARY KEY ("id")
            )
        `);

        // Unique filtered index for idempotency
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IX_ExternalEventLogs_Provider_ExternalEventId"
            ON "ExternalEventLogs" ("provider", "externalEventId")
            WHERE "externalEventId" IS NOT NULL
        `);

        await queryRunner.query(`
            CREATE INDEX "IX_ExternalEventLogs_Provider"
            ON "ExternalEventLogs" ("provider")
        `);

        await queryRunner.query(`
            CREATE INDEX "IX_ExternalEventLogs_Status"
            ON "ExternalEventLogs" ("status")
        `);

        await queryRunner.query(`
            CREATE INDEX "IX_ExternalEventLogs_ReceivedAt"
            ON "ExternalEventLogs" ("receivedAt")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IX_ExternalEventLogs_ReceivedAt" ON "ExternalEventLogs"`);
        await queryRunner.query(`DROP INDEX "IX_ExternalEventLogs_Status" ON "ExternalEventLogs"`);
        await queryRunner.query(`DROP INDEX "IX_ExternalEventLogs_Provider" ON "ExternalEventLogs"`);
        await queryRunner.query(`DROP INDEX "IX_ExternalEventLogs_Provider_ExternalEventId" ON "ExternalEventLogs"`);
        await queryRunner.query(`DROP TABLE "ExternalEventLogs"`);
    }
}
