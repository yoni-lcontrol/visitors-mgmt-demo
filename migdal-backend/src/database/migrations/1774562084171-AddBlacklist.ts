import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlacklist1774562084171 implements MigrationInterface {
    name = 'AddBlacklist1774562084171'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "Blacklist" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_c3a4e8554f99575619b38d98bd8" DEFAULT NEWSEQUENTIALID(), "createdAt" datetime2 NOT NULL CONSTRAINT "DF_9cbbef63c626adb214b79bd72ce" DEFAULT getdate(), "updatedAt" datetime2 NOT NULL CONSTRAINT "DF_b9c47a3e262043a22dfe1329af8" DEFAULT getdate(), "createdBy" uniqueidentifier, "updatedBy" uniqueidentifier, "isActive" bit NOT NULL CONSTRAINT "DF_15b845e3f70bff12c8cbe5443cb" DEFAULT 1, "firstName" nvarchar(100) NOT NULL, "lastName" nvarchar(100) NOT NULL, "idNumber" nvarchar(50), "reason" nvarchar(500) NOT NULL, "blockedAt" datetime2 NOT NULL CONSTRAINT "DF_be1d55cb7ebfc94fb968e24eb59" DEFAULT GETUTCDATE(), "expiresAt" datetime2, "notes" nvarchar(1000), CONSTRAINT "PK_c3a4e8554f99575619b38d98bd8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "VisitorLogs" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_750816f47d8244bc2b2f0e3e8a0" DEFAULT NEWSEQUENTIALID(), "createdAt" datetime2 NOT NULL CONSTRAINT "DF_e4c06581fc4af9a9bc953649215" DEFAULT getdate(), "updatedAt" datetime2 NOT NULL CONSTRAINT "DF_2f4bea3aaefc9c3ecc8e1833a51" DEFAULT getdate(), "createdBy" uniqueidentifier, "updatedBy" uniqueidentifier, "isActive" bit NOT NULL CONSTRAINT "DF_2b4857463e9bc1e633971ae6a95" DEFAULT 1, "visitorId" uniqueidentifier NOT NULL, "action" nvarchar(50) NOT NULL, "timestamp" datetime2 NOT NULL CONSTRAINT "DF_f8e85a98e4b17ff4b4707a20ca2" DEFAULT GETUTCDATE(), "performedBy" uniqueidentifier, "details" nvarchar(1000), CONSTRAINT "PK_750816f47d8244bc2b2f0e3e8a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "VisitorLogs" ADD CONSTRAINT "FK_9950cd3584a069139ec8d5f9a8d" FOREIGN KEY ("visitorId") REFERENCES "Visitors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "VisitorLogs" ADD CONSTRAINT "FK_8f30550b03bf54ddf37c8ce599c" FOREIGN KEY ("performedBy") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "VisitorLogs" DROP CONSTRAINT "FK_8f30550b03bf54ddf37c8ce599c"`);
        await queryRunner.query(`ALTER TABLE "VisitorLogs" DROP CONSTRAINT "FK_9950cd3584a069139ec8d5f9a8d"`);
        await queryRunner.query(`DROP TABLE "VisitorLogs"`);
        await queryRunner.query(`DROP TABLE "Blacklist"`);
    }

}
