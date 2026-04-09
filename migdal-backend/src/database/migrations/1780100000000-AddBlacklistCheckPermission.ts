import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlacklistCheckPermission1780100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Insert the new permission
        await queryRunner.query(`
            INSERT INTO [Permissions] ([id], [key], [name], [description], [module], [action], [isActive], [createdAt], [updatedAt])
            SELECT NEWID(), 'blacklist.check', 'Blacklist Check', 'Check if a person or vehicle is on the blacklist', 'blacklist', 'check', 1, GETUTCDATE(), GETUTCDATE()
            WHERE NOT EXISTS (SELECT 1 FROM [Permissions] WHERE [key] = 'blacklist.check')
        `);

        // Grant to every role that already has blacklist.read
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT rp.roleId, p.id
            FROM [RolePermissions] rp
            INNER JOIN [Permissions] pr ON rp.permissionId = pr.id AND pr.[key] = 'blacklist.read'
            CROSS JOIN [Permissions] p
            WHERE p.[key] = 'blacklist.check'
              AND NOT EXISTS (
                  SELECT 1 FROM [RolePermissions] rp2 WHERE rp2.roleId = rp.roleId AND rp2.permissionId = p.id
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE rp FROM [RolePermissions] rp
            INNER JOIN [Permissions] p ON rp.permissionId = p.id
            WHERE p.[key] = 'blacklist.check'
        `);

        await queryRunner.query(`
            DELETE FROM [Permissions] WHERE [key] = 'blacklist.check'
        `);
    }
}
