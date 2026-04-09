import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardTemplates1776800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE [CardTemplates] (
                [id]                 uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
                [name]               nvarchar(200)    NOT NULL,
                [description]        nvarchar(500)    NULL,
                [cardWidthMm]        int              NOT NULL DEFAULT 54,
                [cardHeightMm]       int              NOT NULL DEFAULT 86,
                [orientation]        nvarchar(20)     NOT NULL DEFAULT 'landscape',
                [elementsJson]       nvarchar(MAX)    NOT NULL,
                [backgroundColor]    nvarchar(50)     NULL,
                [backgroundImageUrl] nvarchar(MAX)    NULL,
                [createdAt]          datetime2        NOT NULL DEFAULT GETDATE(),
                [updatedAt]          datetime2        NOT NULL DEFAULT GETDATE(),
                [createdBy]          uniqueidentifier NULL,
                [updatedBy]          uniqueidentifier NULL,
                [isActive]           bit              NOT NULL DEFAULT 1,
                CONSTRAINT [PK_CardTemplates] PRIMARY KEY ([id])
            )
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_CardTemplates_IsActive] ON [CardTemplates] ([isActive])
        `);

        // Seed new permissions for card templates
        await queryRunner.query(`
            INSERT INTO [Permissions] ([id], [key], [name], [description], [module], [action], [isActive], [createdAt], [updatedAt])
            VALUES
                (NEWID(), 'settings.card-templates.read',   'Settings Card Templates Read',   'Permission to read card templates',   'settings', 'card-templates.read',   1, GETDATE(), GETDATE()),
                (NEWID(), 'settings.card-templates.create', 'Settings Card Templates Create', 'Permission to create card templates', 'settings', 'card-templates.create', 1, GETDATE(), GETDATE()),
                (NEWID(), 'settings.card-templates.update', 'Settings Card Templates Update', 'Permission to update card templates', 'settings', 'card-templates.update', 1, GETDATE(), GETDATE()),
                (NEWID(), 'settings.card-templates.delete', 'Settings Card Templates Delete', 'Permission to delete card templates', 'settings', 'card-templates.delete', 1, GETDATE(), GETDATE())
        `);

        // Grant all 4 card template permissions to the Admin role
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name = 'Admin'
              AND p.[key] IN (
                  'settings.card-templates.read',
                  'settings.card-templates.create',
                  'settings.card-templates.update',
                  'settings.card-templates.delete'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM [RolePermissions] rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);

        // Grant read permission to Operator and Viewer roles
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name IN ('Operator', 'Viewer')
              AND p.[key] = 'settings.card-templates.read'
              AND NOT EXISTS (
                  SELECT 1 FROM [RolePermissions] rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove role-permission mappings
        await queryRunner.query(`
            DELETE FROM [RolePermissions]
            WHERE [permissionId] IN (
                SELECT [id] FROM [Permissions]
                WHERE [key] IN (
                    'settings.card-templates.read',
                    'settings.card-templates.create',
                    'settings.card-templates.update',
                    'settings.card-templates.delete'
                )
            )
        `);

        // Remove permissions
        await queryRunner.query(`
            DELETE FROM [Permissions]
            WHERE [key] IN (
                'settings.card-templates.read',
                'settings.card-templates.create',
                'settings.card-templates.update',
                'settings.card-templates.delete'
            )
        `);

        await queryRunner.query(`DROP INDEX [IX_CardTemplates_IsActive] ON [CardTemplates]`);
        await queryRunner.query(`DROP TABLE [CardTemplates]`);
    }
}
