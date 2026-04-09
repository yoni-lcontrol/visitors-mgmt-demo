import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlacklistDurationAndUserFields1774700000000 implements MigrationInterface {
    name = 'AddBlacklistDurationAndUserFields1774700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add email and phone to Users
        await queryRunner.query(`ALTER TABLE "Users" ADD "email" nvarchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE "Users" ADD "phone" nvarchar(50) NULL`);

        // Add blacklist duration fields
        await queryRunner.query(`ALTER TABLE "Blacklist" ADD "isPermanent" bit NOT NULL CONSTRAINT "DF_Blacklist_isPermanent" DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "Blacklist" ADD "startDate" date NULL`);
        await queryRunner.query(`ALTER TABLE "Blacklist" ADD "endDate" date NULL`);

        // Create BlacklistNotifyUsers join table
        await queryRunner.query(`CREATE TABLE "BlacklistNotifyUsers" (
            "blacklistId" uniqueidentifier NOT NULL,
            "userId" uniqueidentifier NOT NULL,
            CONSTRAINT "PK_BlacklistNotifyUsers" PRIMARY KEY ("blacklistId", "userId")
        )`);
        await queryRunner.query(`ALTER TABLE "BlacklistNotifyUsers" ADD CONSTRAINT "FK_BlacklistNotifyUsers_blacklistId" FOREIGN KEY ("blacklistId") REFERENCES "Blacklist"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "BlacklistNotifyUsers" ADD CONSTRAINT "FK_BlacklistNotifyUsers_userId" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "IDX_BlacklistNotifyUsers_blacklistId" ON "BlacklistNotifyUsers" ("blacklistId")`);
        await queryRunner.query(`CREATE INDEX "IDX_BlacklistNotifyUsers_userId" ON "BlacklistNotifyUsers" ("userId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_BlacklistNotifyUsers_userId" ON "BlacklistNotifyUsers"`);
        await queryRunner.query(`DROP INDEX "IDX_BlacklistNotifyUsers_blacklistId" ON "BlacklistNotifyUsers"`);
        await queryRunner.query(`ALTER TABLE "BlacklistNotifyUsers" DROP CONSTRAINT "FK_BlacklistNotifyUsers_userId"`);
        await queryRunner.query(`ALTER TABLE "BlacklistNotifyUsers" DROP CONSTRAINT "FK_BlacklistNotifyUsers_blacklistId"`);
        await queryRunner.query(`DROP TABLE "BlacklistNotifyUsers"`);

        await queryRunner.query(`ALTER TABLE "Blacklist" DROP CONSTRAINT "DF_Blacklist_isPermanent"`);
        await queryRunner.query(`ALTER TABLE "Blacklist" DROP COLUMN "endDate"`);
        await queryRunner.query(`ALTER TABLE "Blacklist" DROP COLUMN "startDate"`);
        await queryRunner.query(`ALTER TABLE "Blacklist" DROP COLUMN "isPermanent"`);

        await queryRunner.query(`ALTER TABLE "Users" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "Users" DROP COLUMN "email"`);
    }
}
