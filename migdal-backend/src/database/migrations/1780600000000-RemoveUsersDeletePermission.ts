import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUsersDeletePermission1780600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove role-permission assignments
        await queryRunner.query(`
            DELETE rp FROM [RolePermissions] rp
            INNER JOIN [Permissions] p ON rp.permissionId = p.id
            WHERE p.[key] = 'users.delete'
        `);

        // Remove the permission itself
        await queryRunner.query(`
            DELETE FROM [Permissions] WHERE [key] = 'users.delete'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO [Permissions] ([id], [key], [name], [module], [action], [description], [createdAt], [updatedAt])
            VALUES (NEWID(), 'users.delete', 'Delete Users', 'users', 'delete', 'Deactivate user accounts', GETUTCDATE(), GETUTCDATE())
        `);
    }
}
