import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailTemplates1776200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE [EmailTemplates] (
                [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [event]       NVARCHAR(50)     NOT NULL,
                [subject]     NVARCHAR(255)    NOT NULL,
                [bodyHtml]    NVARCHAR(MAX)    NOT NULL,
                [recipients]  NVARCHAR(MAX)    NULL,
                [isActive]    BIT              NOT NULL DEFAULT 1,
                [createdAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                [updatedAt]   DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
                [createdBy]   UNIQUEIDENTIFIER NULL,
                [updatedBy]   UNIQUEIDENTIFIER NULL,
                CONSTRAINT [PK_EmailTemplates] PRIMARY KEY ([id]),
                CONSTRAINT [UQ_EmailTemplates_event] UNIQUE ([event])
            )
        `);

        await queryRunner.query(`
            INSERT INTO [EmailTemplates] ([event], [subject], [bodyHtml])
            VALUES
                ('visit_created',
                 N'ביקור חדש: {{visit.title}}',
                 N'<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #6c63ff;padding-bottom:10px">ביקור חדש נוצר</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">כותרת:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">תאריך התחלה:</td><td style="padding:8px 0">{{visit.startTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">תאריך סיום:</td><td style="padding:8px 0">{{visit.endTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מבקר:</td><td style="padding:8px 0">{{visitor.firstName}} {{visitor.lastName}}</td></tr></table></div>'),
                ('visit_updated',
                 N'ביקור עודכן: {{visit.title}}',
                 N'<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#020140;border-bottom:2px solid #f0ad4e;padding-bottom:10px">ביקור עודכן</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">כותרת:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מועד:</td><td style="padding:8px 0">{{visit.startTime}} - {{visit.endTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">אתר:</td><td style="padding:8px 0">{{visit.siteName}}</td></tr></table></div>'),
                ('visit_deleted',
                 N'ביקור בוטל: {{visit.title}}',
                 N'<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#d9534f;border-bottom:2px solid #d9534f;padding-bottom:10px">ביקור בוטל</h2><p style="font-size:16px">הביקור <strong>{{visit.title}}</strong> בוטל.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">מועד מתוכנן:</td><td style="padding:8px 0">{{visit.startTime}} - {{visit.endTime}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr></table></div>'),
                ('visitor_arrived',
                 N'מבקר הגיע: {{visitor.firstName}} {{visitor.lastName}}',
                 N'<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#5cb85c;border-bottom:2px solid #5cb85c;padding-bottom:10px">מבקר הגיע</h2><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#555">שם:</td><td style="padding:8px 0">{{visitor.firstName}} {{visitor.lastName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ת.ז.:</td><td style="padding:8px 0">{{visitor.personId}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ביקור:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr></table></div>'),
                ('visitor_blacklisted',
                 N'אזהרה: מבקר ברשימה שחורה הגיע!',
                 N'<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#fff;background:#d9534f;padding:15px;border-radius:6px;text-align:center">אזהרה: מבקר ברשימה שחורה!</h2><table style="width:100%;border-collapse:collapse;margin-top:15px"><tr><td style="padding:8px 0;font-weight:bold;color:#555">שם:</td><td style="padding:8px 0;color:#d9534f;font-weight:bold">{{visitor.firstName}} {{visitor.lastName}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ת.ז.:</td><td style="padding:8px 0">{{visitor.personId}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">ביקור:</td><td style="padding:8px 0">{{visit.title}}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#555">מארח:</td><td style="padding:8px 0">{{visit.hostName}}</td></tr></table></div>')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE [EmailTemplates]`);
    }
}
