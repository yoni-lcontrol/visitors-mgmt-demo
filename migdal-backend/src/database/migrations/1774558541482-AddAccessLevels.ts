import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccessLevels1774558541482 implements MigrationInterface {
    name = 'AddAccessLevels1774558541482'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "AccessLevels" ("id" uniqueidentifier NOT NULL CONSTRAINT "DF_28afc47d5ef3bcc7c73201efc4d" DEFAULT NEWSEQUENTIALID(), "createdAt" datetime2 NOT NULL CONSTRAINT "DF_aa75e1e9d18e8008df49ecc6fe0" DEFAULT getdate(), "updatedAt" datetime2 NOT NULL CONSTRAINT "DF_fb2c0230f13a10471c47d7c2e20" DEFAULT getdate(), "createdBy" uniqueidentifier, "updatedBy" uniqueidentifier, "isActive" bit NOT NULL CONSTRAINT "DF_663448a30fd17b93f9eef6b81d6" DEFAULT 1, "name" nvarchar(200) NOT NULL, "active" bit NOT NULL CONSTRAINT "DF_afe4f7dbf09ddcd0ec1cd79f28e" DEFAULT 1, "visitorAccess" bit NOT NULL CONSTRAINT "DF_fdec6ed589eddbc4703712e9e90" DEFAULT 0, CONSTRAINT "PK_28afc47d5ef3bcc7c73201efc4d" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "AccessLevels"`);
    }

}
