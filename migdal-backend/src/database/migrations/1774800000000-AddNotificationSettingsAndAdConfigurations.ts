import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationSettingsAndAdConfigurations1774800000000 implements MigrationInterface {
    name = 'AddNotificationSettingsAndAdConfigurations1774800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // NotificationSettings table
        await queryRunner.query(`
            CREATE TABLE [NotificationSettings] (
                [id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [targetGroup]   NVARCHAR(50)     NOT NULL,
                [event]         NVARCHAR(50)     NOT NULL,
                [channel]       NVARCHAR(20)     NOT NULL,
                [enabled]       BIT              NOT NULL DEFAULT 0,
                [isActive]      BIT              NOT NULL DEFAULT 1,
                [createdAt]     DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]     DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]     UNIQUEIDENTIFIER NULL,
                [updatedBy]     UNIQUEIDENTIFIER NULL,
                CONSTRAINT [PK_NotificationSettings] PRIMARY KEY ([id]),
                CONSTRAINT [UQ_NotificationSettings_group_event_channel] UNIQUE ([targetGroup], [event], [channel])
            )
        `);

        // AdConfigurations table
        await queryRunner.query(`
            CREATE TABLE [AdConfigurations] (
                [id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [name]        NVARCHAR(200)    NOT NULL,
                [domain]      NVARCHAR(255)    NOT NULL,
                [ldapUrl]     NVARCHAR(500)    NOT NULL,
                [baseDn]      NVARCHAR(200)    NULL,
                [username]    NVARCHAR(200)    NOT NULL,
                [password]    NVARCHAR(500)    NOT NULL,
                [port]        INT              NOT NULL DEFAULT 389,
                [useSsl]      BIT              NOT NULL DEFAULT 0,
                [description] NVARCHAR(500)    NULL,
                [isActive]    BIT              NOT NULL DEFAULT 1,
                [createdAt]   DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]   DATETIME2        NOT NULL DEFAULT GETDATE(),
                [createdBy]   UNIQUEIDENTIFIER NULL,
                [updatedBy]   UNIQUEIDENTIFIER NULL,
                CONSTRAINT [PK_AdConfigurations] PRIMARY KEY ([id])
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE [AdConfigurations]`);
        await queryRunner.query(`DROP TABLE [NotificationSettings]`);
    }
}
