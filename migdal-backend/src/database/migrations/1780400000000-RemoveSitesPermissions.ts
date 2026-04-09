import { MigrationInterface, QueryRunner } from 'typeorm';

const SITES_KEYS = [
    'sites.create',
    'sites.read',
    'sites.update',
    'sites.delete',
    'sites.assign-users',
];

export class RemoveSitesPermissions1780400000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const keyList = SITES_KEYS.map((k) => `'${k}'`).join(', ');

        // Remove role-permission assignments
        await queryRunner.query(`
            DELETE rp FROM [RolePermissions] rp
            INNER JOIN [Permissions] p ON rp.permissionId = p.id
            WHERE p.[key] IN (${keyList})
        `);

        // Remove the permissions themselves
        await queryRunner.query(`
            DELETE FROM [Permissions] WHERE [key] IN (${keyList})
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-create the permissions
        for (const key of SITES_KEYS) {
            const [module, action] = key.split('.');
            const name = key
                .replace('.', ' ')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());
            await queryRunner.query(`
                INSERT INTO [Permissions] ([id], [key], [name], [description], [module], [action], [isActive], [createdAt], [updatedAt])
                SELECT NEWID(), '${key}', '${name}', 'Permission to ${action} ${module}', '${module}', '${action}', 1, GETDATE(), GETDATE()
                WHERE NOT EXISTS (SELECT 1 FROM [Permissions] WHERE [key] = '${key}')
            `);
        }

        // Re-grant to Admin role
        const keyList = SITES_KEYS.map((k) => `'${k}'`).join(', ');
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name = 'Admin'
              AND p.[key] IN (${keyList})
              AND NOT EXISTS (
                  SELECT 1 FROM [RolePermissions] rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);
    }
}
