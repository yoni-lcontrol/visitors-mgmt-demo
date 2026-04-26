import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSectorToVisitEscorts1781900000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [VisitEscorts]
                ADD [sector] nvarchar(200) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [VisitEscorts]
                DROP COLUMN [sector]
        `);
    }
}
