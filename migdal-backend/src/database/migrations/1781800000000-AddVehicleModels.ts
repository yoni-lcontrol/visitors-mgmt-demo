import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleModels1781800000000 implements MigrationInterface {
    name = 'AddVehicleModels1781800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF OBJECT_ID(N'[VehicleManufacturers]', N'U') IS NULL
            BEGIN
                CREATE TABLE [VehicleManufacturers] (
                    [name]      NVARCHAR(120) NOT NULL,
                    [createdAt] DATETIME2     NOT NULL DEFAULT GETDATE(),
                    [updatedAt] DATETIME2     NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT [PK_VehicleManufacturers] PRIMARY KEY ([name])
                )
            END
        `);

        await queryRunner.query(`
            IF OBJECT_ID(N'[VehicleModels]', N'U') IS NULL
            BEGIN
                CREATE TABLE [VehicleModels] (
                    [id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
                    [manufacturer] NVARCHAR(120)    NOT NULL,
                    [model]        NVARCHAR(120)    NOT NULL,
                    [createdAt]    DATETIME2        NOT NULL DEFAULT GETDATE(),
                    [updatedAt]    DATETIME2        NOT NULL DEFAULT GETDATE(),
                    [createdBy]    UNIQUEIDENTIFIER NULL,
                    [updatedBy]    UNIQUEIDENTIFIER NULL,
                    CONSTRAINT [PK_VehicleModels] PRIMARY KEY ([id]),
                    CONSTRAINT [FK_VehicleModels_Manufacturer]
                        FOREIGN KEY ([manufacturer]) REFERENCES [VehicleManufacturers]([name])
                        ON DELETE NO ACTION ON UPDATE NO ACTION
                )
            END
        `);

        await queryRunner.query(`
            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes WHERE name = 'UQ_VehicleModels_Manufacturer_Model' AND object_id = OBJECT_ID('VehicleModels')
            )
            BEGIN
                CREATE UNIQUE INDEX [UQ_VehicleModels_Manufacturer_Model]
                ON [VehicleModels] ([manufacturer], [model])
            END
        `);

        await queryRunner.query(`
            INSERT INTO [Permissions] ([id], [key], [name], [description], [module], [action], [isActive], [createdAt], [updatedAt])
            SELECT NEWID(), v.[key], v.[name], v.[description], v.[module], v.[action], 1, GETDATE(), GETDATE()
            FROM (VALUES
                ('vehicle-models.view',   'Vehicle Models View',   'Permission to view vehicle models',   'vehicle-models', 'view'),
                ('vehicle-models.create', 'Vehicle Models Create', 'Permission to create vehicle models', 'vehicle-models', 'create'),
                ('vehicle-models.update', 'Vehicle Models Update', 'Permission to update vehicle models', 'vehicle-models', 'update'),
                ('vehicle-models.delete', 'Vehicle Models Delete', 'Permission to delete vehicle models', 'vehicle-models', 'delete'),
                ('vehicle-models.export', 'Vehicle Models Export', 'Permission to export vehicle models', 'vehicle-models', 'export')
            ) AS v([key], [name], [description], [module], [action])
            WHERE NOT EXISTS (SELECT 1 FROM [Permissions] p WHERE p.[key] = v.[key])
        `);

        await queryRunner.query(`
            INSERT INTO [RolePermissions] ([roleId], [permissionId])
            SELECT r.id, p.id
            FROM [Roles] r
            CROSS JOIN [Permissions] p
            WHERE r.name = 'Admin'
              AND p.[key] IN ('vehicle-models.view', 'vehicle-models.create', 'vehicle-models.update', 'vehicle-models.delete', 'vehicle-models.export')
              AND NOT EXISTS (
                  SELECT 1 FROM [RolePermissions] rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE rp FROM [RolePermissions] rp
            INNER JOIN [Permissions] p ON rp.permissionId = p.id
            WHERE p.[key] IN ('vehicle-models.view', 'vehicle-models.create', 'vehicle-models.update', 'vehicle-models.delete', 'vehicle-models.export')
        `);

        await queryRunner.query(`
            DELETE FROM [Permissions]
            WHERE [key] IN ('vehicle-models.view', 'vehicle-models.create', 'vehicle-models.update', 'vehicle-models.delete', 'vehicle-models.export')
        `);

        await queryRunner.query(`
            IF EXISTS (
                SELECT 1 FROM sys.indexes WHERE name = 'UQ_VehicleModels_Manufacturer_Model' AND object_id = OBJECT_ID('VehicleModels')
            )
            BEGIN
                DROP INDEX [UQ_VehicleModels_Manufacturer_Model] ON [VehicleModels]
            END
        `);

        await queryRunner.query(`
            IF OBJECT_ID(N'[VehicleModels]', N'U') IS NOT NULL
            BEGIN
                DROP TABLE [VehicleModels]
            END
        `);

        await queryRunner.query(`
            IF OBJECT_ID(N'[VehicleManufacturers]', N'U') IS NOT NULL
            BEGIN
                DROP TABLE [VehicleManufacturers]
            END
        `);
    }
}
