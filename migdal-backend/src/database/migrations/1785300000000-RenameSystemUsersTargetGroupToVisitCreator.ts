import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The 'system_users' notification target group actually represents the user who
 * created/booked the visit (visit.createdByUser), not generic platform staff — the
 * name was misleading admins configuring notification settings. Renaming the value
 * to 'visit_creator' to match its real meaning, alongside the visit_requester group.
 * Existing rows must be updated in place (not re-seeded) so admins don't lose their
 * already-configured enabled/disabled toggles and custom templates.
 */
export class RenameSystemUsersTargetGroupToVisitCreator1785300000000 implements MigrationInterface {
    name = 'RenameSystemUsersTargetGroupToVisitCreator1785300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationSettings')
            UPDATE [dbo].[NotificationSettings] SET [targetGroup] = 'visit_creator' WHERE [targetGroup] = 'system_users'
        `);

        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'EmailTemplates')
            UPDATE [dbo].[EmailTemplates] SET [targetGroup] = 'visit_creator' WHERE [targetGroup] = 'system_users'
        `);

        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SmsTemplates')
            UPDATE [dbo].[SmsTemplates] SET [targetGroup] = 'visit_creator' WHERE [targetGroup] = 'system_users'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'NotificationSettings')
            UPDATE [dbo].[NotificationSettings] SET [targetGroup] = 'system_users' WHERE [targetGroup] = 'visit_creator'
        `);

        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'EmailTemplates')
            UPDATE [dbo].[EmailTemplates] SET [targetGroup] = 'system_users' WHERE [targetGroup] = 'visit_creator'
        `);

        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SmsTemplates')
            UPDATE [dbo].[SmsTemplates] SET [targetGroup] = 'system_users' WHERE [targetGroup] = 'visit_creator'
        `);
    }
}
