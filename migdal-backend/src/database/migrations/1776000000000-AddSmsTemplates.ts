import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSmsTemplates1776000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE [SmsTemplates] (
                [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [event]       NVARCHAR(50)     NOT NULL,
                [template]    NVARCHAR(MAX)    NOT NULL,
                [smsEnabled]  BIT              NOT NULL DEFAULT 1,
                [recipients]  NVARCHAR(MAX)    NULL,
                [isActive]    BIT              NOT NULL DEFAULT 1,
                [createdAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                [updatedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                [createdBy]   UNIQUEIDENTIFIER NULL,
                [updatedBy]   UNIQUEIDENTIFIER NULL,
                CONSTRAINT [PK_SmsTemplates] PRIMARY KEY ([id]),
                CONSTRAINT [UQ_SmsTemplates_event] UNIQUE ([event])
            )
        `);

        // Seed default templates for each event
        await queryRunner.query(`
            INSERT INTO [SmsTemplates] ([event], [template], [smsEnabled])
            VALUES
                ('visit_created',        N'ביקור חדש: {{visit.title}} מתוכנן ל-{{visit.startTime}}. מבקר: {{visitor.firstName}} {{visitor.lastName}}.', 0),
                ('visit_updated',        N'ביקור עודכן: {{visit.title}}. מועד: {{visit.startTime}} - {{visit.endTime}}.', 0),
                ('visit_deleted',        N'ביקור בוטל: {{visit.title}}.', 0),
                ('visitor_arrived',      N'מבקר הגיע: {{visitor.firstName}} {{visitor.lastName}} ({{visitor.personId}}) לביקור {{visit.title}}.', 0),
                ('visitor_blacklisted',  N'אזהרה: מבקר ברשימה שחורה הגיע! {{visitor.firstName}} {{visitor.lastName}} ({{visitor.personId}}).', 0)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS [SmsTemplates]`);
    }
}
