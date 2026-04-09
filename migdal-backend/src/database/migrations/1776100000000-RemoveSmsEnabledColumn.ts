import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSmsEnabledColumn1776100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the default constraint before dropping the column
        await queryRunner.query(`
            DECLARE @constraintName NVARCHAR(256);
            SELECT @constraintName = dc.name
            FROM sys.default_constraints dc
            JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
            WHERE c.name = 'smsEnabled' AND OBJECT_NAME(dc.parent_object_id) = 'SmsTemplates';
            IF @constraintName IS NOT NULL
                EXEC('ALTER TABLE [SmsTemplates] DROP CONSTRAINT [' + @constraintName + ']');
        `);
        await queryRunner.query(`ALTER TABLE [SmsTemplates] DROP COLUMN [smsEnabled]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [SmsTemplates] ADD [smsEnabled] BIT NOT NULL DEFAULT 1`);
    }
}
