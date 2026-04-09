import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBuildings1778900000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Buildings table
        await queryRunner.query(`
            CREATE TABLE [Buildings] (
                [id]        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                [name]      NVARCHAR(200)    NOT NULL,
                [address]   NVARCHAR(500)    NULL,
                [active]    BIT              NOT NULL DEFAULT 1,
                [isActive]  BIT              NOT NULL DEFAULT 1,
                [createdBy] UNIQUEIDENTIFIER NULL,
                [updatedBy] UNIQUEIDENTIFIER NULL,
                [createdAt] DATETIME2        NOT NULL DEFAULT GETDATE(),
                [updatedAt] DATETIME2        NOT NULL DEFAULT GETDATE(),
                CONSTRAINT [PK_Buildings] PRIMARY KEY ([id])
            )
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_Buildings_IsActive] ON [Buildings] ([isActive])
        `);

        // Add buildingId FK to Visits
        await queryRunner.query(`
            ALTER TABLE [Visits] ADD [buildingId] UNIQUEIDENTIFIER NULL
        `);

        await queryRunner.query(`
            ALTER TABLE [Visits] ADD CONSTRAINT [FK_Visits_Building]
            FOREIGN KEY ([buildingId]) REFERENCES [Buildings]([id]) ON DELETE NO ACTION
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_Visits_BuildingId] ON [Visits] ([buildingId])
        `);

        // Seed building permissions (skip if already seeded by SeedService)
        await queryRunner.query(`
            INSERT INTO [Permissions] ([id], [key], [name], [description], [module], [action], [isActive], [createdAt], [updatedAt])
            SELECT NEWID(), v.[key], v.[name], v.[description], v.[module], v.[action], 1, GETDATE(), GETDATE()
            FROM (VALUES
                ('buildings.read',   'Buildings Read',   'Permission to read buildings',   'buildings', 'read'),
                ('buildings.create', 'Buildings Create', 'Permission to create buildings', 'buildings', 'create'),
                ('buildings.update', 'Buildings Update', 'Permission to update buildings', 'buildings', 'update'),
                ('buildings.delete', 'Buildings Delete', 'Permission to delete buildings', 'buildings', 'delete')
            ) AS v([key], [name], [description], [module], [action])
            WHERE NOT EXISTS (SELECT 1 FROM [Permissions] p WHERE p.[key] = v.[key])
        `);

        // Grant all 4 building permissions to Admin role
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name = 'Admin'
              AND p.[key] IN ('buildings.read', 'buildings.create', 'buildings.update', 'buildings.delete')
              AND NOT EXISTS (
                  SELECT 1 FROM [RolePermissions] rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);

        // Grant read + create + update to Operator role
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name = 'Operator'
              AND p.[key] IN ('buildings.read', 'buildings.create', 'buildings.update')
              AND NOT EXISTS (
                  SELECT 1 FROM [RolePermissions] rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);

        // Grant read to Viewer role
        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name = 'Viewer'
              AND p.[key] = 'buildings.read'
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
            WHERE p.[key] IN ('buildings.read', 'buildings.create', 'buildings.update', 'buildings.delete')
        `);

        // Remove permissions
        await queryRunner.query(`
            DELETE FROM [Permissions] WHERE [key] IN ('buildings.read', 'buildings.create', 'buildings.update', 'buildings.delete')
        `);

        // Remove FK and column from Visits
        await queryRunner.query(`ALTER TABLE [Visits] DROP CONSTRAINT [FK_Visits_Building]`);
        await queryRunner.query(`DROP INDEX [IX_Visits_BuildingId] ON [Visits]`);
        await queryRunner.query(`ALTER TABLE [Visits] DROP COLUMN [buildingId]`);

        // Drop Buildings table
        await queryRunner.query(`DROP TABLE [Buildings]`);
    }
}
