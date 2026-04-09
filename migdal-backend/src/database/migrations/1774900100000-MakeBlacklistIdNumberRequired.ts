import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeBlacklistIdNumberRequired1774900100000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Fill any existing NULLs before adding NOT NULL constraint
        await queryRunner.query(`UPDATE [Blacklist] SET [idNumber] = '' WHERE [idNumber] IS NULL`);
        await queryRunner.query(`ALTER TABLE [Blacklist] ALTER COLUMN [idNumber] NVARCHAR(50) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Blacklist] ALTER COLUMN [idNumber] NVARCHAR(50) NULL`);
    }
}
