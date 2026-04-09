import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTargetGroupToSmsTemplates1780200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add targetGroup column with default 'system_users'
        await queryRunner.query(`
            ALTER TABLE [SmsTemplates]
            ADD [targetGroup] NVARCHAR(50) NOT NULL DEFAULT 'system_users'
        `);

        // 2. Drop the old unique constraint on event only
        await queryRunner.query(`
            ALTER TABLE [SmsTemplates]
            DROP CONSTRAINT [UQ_SmsTemplates_event]
        `);

        // 3. Duplicate existing rows for the other 3 target groups
        const groups = ['visitors', 'escorts', 'visit_requester'];
        for (const group of groups) {
            await queryRunner.query(`
                INSERT INTO [SmsTemplates] ([event], [targetGroup], [template], [recipients], [isActive], [createdAt], [updatedAt], [createdBy], [updatedBy])
                SELECT [event], '${group}', [template], [recipients], [isActive], GETUTCDATE(), GETUTCDATE(), [createdBy], [updatedBy]
                FROM [SmsTemplates]
                WHERE [targetGroup] = 'system_users'
            `);
        }

        // 4. Add the new composite unique constraint
        await queryRunner.query(`
            ALTER TABLE [SmsTemplates]
            ADD CONSTRAINT [UQ_SmsTemplates_event_targetGroup] UNIQUE ([event], [targetGroup])
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop composite unique constraint
        await queryRunner.query(`
            ALTER TABLE [SmsTemplates]
            DROP CONSTRAINT [UQ_SmsTemplates_event_targetGroup]
        `);

        // 2. Delete duplicated rows (keep only system_users)
        await queryRunner.query(`
            DELETE FROM [SmsTemplates]
            WHERE [targetGroup] != 'system_users'
        `);

        // 3. Restore original unique constraint on event only
        await queryRunner.query(`
            ALTER TABLE [SmsTemplates]
            ADD CONSTRAINT [UQ_SmsTemplates_event] UNIQUE ([event])
        `);

        // 4. Drop targetGroup column
        await queryRunner.query(`
            ALTER TABLE [SmsTemplates]
            DROP CONSTRAINT [DF__SmsTempla__targe__default]
        `);
        await queryRunner.query(`
            ALTER TABLE [SmsTemplates]
            DROP COLUMN [targetGroup]
        `);
    }
}
