import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserIdToVisitEscorts1785100000000 implements MigrationInterface {
    name = 'AddUserIdToVisitEscorts1785100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "VisitEscorts" ADD "userId" uniqueidentifier NULL`);
        await queryRunner.query(`ALTER TABLE "VisitEscorts" ADD CONSTRAINT "FK_VisitEscorts_userId" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "VisitEscorts" DROP CONSTRAINT "FK_VisitEscorts_userId"`);
        await queryRunner.query(`ALTER TABLE "VisitEscorts" DROP COLUMN "userId"`);
    }
}
