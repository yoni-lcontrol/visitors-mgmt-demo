import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePasswordHashNullable1778700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE [Users]
            ALTER COLUMN [passwordHash] NVARCHAR(255) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Set any NULLs to a placeholder before making NOT NULL again
        await queryRunner.query(`
            UPDATE [Users] SET [passwordHash] = 'NO_PASSWORD_SET' WHERE [passwordHash] IS NULL
        `);
        await queryRunner.query(`
            ALTER TABLE [Users]
            ALTER COLUMN [passwordHash] NVARCHAR(255) NOT NULL
        `);
    }
}
