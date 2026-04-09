import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdNumberToUsers1778600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [Users]
            ADD [idNumber] NVARCHAR(50) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [Users]
            DROP COLUMN [idNumber]
        `);
    }
}
