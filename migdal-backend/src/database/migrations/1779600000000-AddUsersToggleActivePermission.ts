import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersToggleActivePermission1779600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Insert the new permission
        await queryRunner.query(`
            INSERT INTO [Permissions] ([id], [key], [name], [description], [module], [action], [isActive], [createdAt], [updatedAt])
            SELECT NEWID(), 'users.toggle-active', 'Toggle User Active', 'Activate or deactivate system users', 'users', 'toggle-active', 1, GETDATE(), GETDATE()
            WHERE NOT EXISTS (SELECT 1 FROM [Permissions] WHERE [key] = 'users.toggle-active')
        `);

        // Grant to Admin role
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name = 'Admin'
              AND p.[key] = 'users.toggle-active'
              AND NOT EXISTS (
                  SELECT 1 FROM [RolePermissions] rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove role-permission assignments
        await queryRunner.query(`
            DELETE rp FROM [RolePermissions] rp
            INNER JOIN [Permissions] p ON rp.permissionId = p.id
            WHERE p.[key] = 'users.toggle-active'
        `);

        // Remove the permission
        await queryRunner.query(`
            DELETE FROM [Permissions] WHERE [key] = 'users.toggle-active'
        `);
    }
}
