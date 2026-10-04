import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The 'system_users' notification target group actually represents the user who
 * created/booked the visit (visit.createdByUser), not generic platform staff — the
 * name was misleading admins configuring notification settings. Renaming the value
 * to 'visit_creator' to match its real meaning, alongside the visit_requester group.
 * Existing rows must be updated in place (not re-seeded) so admins don't lose their
 * already-configured enabled/disabled toggles and custom templates.
 *
 * EmailTemplates/SmsTemplates carry a UNIQUE(event, targetGroup) constraint, and on
 * environments where the seed already ran with the newer 'visit_creator' value (see
 * email-templates.seed.ts / sms-templates.seed.ts — neither seeds 'system_users'
 * anymore), a 'visit_creator' row can already exist for the same event as the legacy
 * 'system_users' row this migration renames. That freshly-seeded duplicate carries no
 * admin customization (it's default seed content), so it's dropped in favor of
 * renaming the legacy row in place, per this migration's own goal above.
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
            DELETE dup FROM [dbo].[EmailTemplates] dup
            INNER JOIN [dbo].[EmailTemplates] legacy
                ON legacy.[event] = dup.[event] AND legacy.[targetGroup] = 'system_users'
            WHERE dup.[targetGroup] = 'visit_creator'
        `);
        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'EmailTemplates')
            UPDATE [dbo].[EmailTemplates] SET [targetGroup] = 'visit_creator' WHERE [targetGroup] = 'system_users'
        `);

        await queryRunner.query(`
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SmsTemplates')
            DELETE dup FROM [dbo].[SmsTemplates] dup
            INNER JOIN [dbo].[SmsTemplates] legacy
                ON legacy.[event] = dup.[event] AND legacy.[targetGroup] = 'system_users'
            WHERE dup.[targetGroup] = 'visit_creator'
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
