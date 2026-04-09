import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdSyncFieldsToUsers1776600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add AD sync metadata columns to Users table
        await queryRunner.query(`
            ALTER TABLE [Users]
                ADD [adSourceId] uniqueidentifier NULL,
                    [adExternalId] nvarchar(255) NULL,
                    [lastSyncedAt] datetime2 NULL,
                    [syncSource] nvarchar(20) NOT NULL CONSTRAINT [DF_Users_syncSource] DEFAULT 'local',
                    [department] nvarchar(200) NULL,
                    [title] nvarchar(200) NULL
        `);

        // Foreign key to AdConfigurations
        await queryRunner.query(`
            ALTER TABLE [Users]
                ADD CONSTRAINT [FK_Users_AdConfigurations]
                FOREIGN KEY ([adSourceId]) REFERENCES [AdConfigurations]([id])
        `);

        // Indexes for efficient sync matching
        await queryRunner.query(`CREATE INDEX [IX_Users_adExternalId] ON [Users]([adExternalId])`);
        await queryRunner.query(`CREATE INDEX [IX_Users_adSourceId] ON [Users]([adSourceId])`);
        await queryRunner.query(`CREATE INDEX [IX_Users_syncSource] ON [Users]([syncSource])`);

        // Add users.sync permission
        await queryRunner.query(`
            INSERT INTO [Permissions] ([id], [key], [name], [description], [module], [action], [createdAt], [updatedAt], [isActive])
            VALUES (NEWID(), 'users.sync', 'Sync AD Users', 'Trigger AD user synchronization', 'users', 'sync', GETUTCDATE(), GETUTCDATE(), 1)
        `);

        // Grant users.sync permission to the Admin role
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name = 'Admin' AND p.[key] = 'users.sync'
              AND NOT EXISTS (
                SELECT 1 FROM [RolePermissions] rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove permission from roles
        await queryRunner.query(`
            DELETE rp FROM [RolePermissions] rp
            INNER JOIN [Permissions] p ON rp.permissionId = p.id
            WHERE p.[key] = 'users.sync'
        `);

        // Remove permission
        await queryRunner.query(`DELETE FROM [Permissions] WHERE [key] = 'users.sync'`);

        // Remove FK and indexes
        await queryRunner.query(`ALTER TABLE [Users] DROP CONSTRAINT [FK_Users_AdConfigurations]`);
        await queryRunner.query(`DROP INDEX [IX_Users_syncSource] ON [Users]`);
        await queryRunner.query(`DROP INDEX [IX_Users_adSourceId] ON [Users]`);
        await queryRunner.query(`DROP INDEX [IX_Users_adExternalId] ON [Users]`);

        // Remove columns
        await queryRunner.query(`ALTER TABLE [Users] DROP CONSTRAINT [DF_Users_syncSource]`);
        await queryRunner.query(`
            ALTER TABLE [Users]
                DROP COLUMN [adSourceId], [adExternalId], [lastSyncedAt], [syncSource], [department], [title]
        `);
    }
}
