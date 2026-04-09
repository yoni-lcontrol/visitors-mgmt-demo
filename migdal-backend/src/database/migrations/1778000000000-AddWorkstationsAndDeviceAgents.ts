import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddWorkstationsAndDeviceAgents1778000000000 implements MigrationInterface {
    name = 'AddWorkstationsAndDeviceAgents1778000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Workstations
        await queryRunner.createTable(
            new Table({
                name: 'Workstations',
                columns: [
                    { name: 'id', type: 'uniqueidentifier', isPrimary: true, default: 'NEWSEQUENTIALID()' },
                    { name: 'machineId', type: 'nvarchar(255)', isNullable: false },
                    { name: 'hostname', type: 'nvarchar(255)', isNullable: false },
                    { name: 'displayName', type: 'nvarchar(255)', isNullable: true },
                    { name: 'siteId', type: 'nvarchar(255)', isNullable: true },
                    { name: 'metadataJson', type: 'nvarchar(MAX)', isNullable: true },
                    { name: 'isActive', type: 'bit', default: 1 },
                    { name: 'createdAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'updatedAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'createdBy', type: 'uniqueidentifier', isNullable: true },
                    { name: 'updatedBy', type: 'uniqueidentifier', isNullable: true },
                ],
            }),
            true,
        );
        await queryRunner.createIndex('Workstations', new TableIndex({
            name: 'IX_Workstations_MachineId',
            columnNames: ['machineId'],
            isUnique: true,
        }));

        // 2. DeviceAgents
        await queryRunner.createTable(
            new Table({
                name: 'DeviceAgents',
                columns: [
                    { name: 'id', type: 'uniqueidentifier', isPrimary: true, default: 'NEWSEQUENTIALID()' },
                    { name: 'workstationId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'providerType', type: 'nvarchar(50)', isNullable: false },
                    { name: 'clientId', type: 'nvarchar(255)', isNullable: false },
                    { name: 'secretVersion', type: 'nvarchar(100)', isNullable: true },
                    { name: 'version', type: 'nvarchar(100)', isNullable: true },
                    { name: 'isEnabled', type: 'bit', default: 1 },
                    { name: 'isActive', type: 'bit', default: 1 },
                    { name: 'createdAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'updatedAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'createdBy', type: 'uniqueidentifier', isNullable: true },
                    { name: 'updatedBy', type: 'uniqueidentifier', isNullable: true },
                ],
            }),
            true,
        );
        await queryRunner.createIndex('DeviceAgents', new TableIndex({
            name: 'IX_DeviceAgents_ClientId',
            columnNames: ['clientId'],
            isUnique: true,
        }));
        await queryRunner.createIndex('DeviceAgents', new TableIndex({
            name: 'IX_DeviceAgents_Workstation_Provider',
            columnNames: ['workstationId', 'providerType'],
        }));
        await queryRunner.createForeignKey('DeviceAgents', new TableForeignKey({
            name: 'FK_DeviceAgents_Workstation',
            columnNames: ['workstationId'],
            referencedTableName: 'Workstations',
            referencedColumnNames: ['id'],
        }));

        // 3. AgentConnections
        await queryRunner.createTable(
            new Table({
                name: 'AgentConnections',
                columns: [
                    { name: 'id', type: 'uniqueidentifier', isPrimary: true, default: 'NEWSEQUENTIALID()' },
                    { name: 'deviceAgentId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'workstationId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'providerType', type: 'nvarchar(50)', isNullable: false },
                    { name: 'socketId', type: 'nvarchar(255)', isNullable: false },
                    { name: 'status', type: 'nvarchar(50)', default: "'connected'" },
                    { name: 'capabilitiesJson', type: 'nvarchar(MAX)', isNullable: true },
                    { name: 'connectedAt', type: 'datetime2', isNullable: false },
                    { name: 'lastSeenAt', type: 'datetime2', isNullable: false },
                    { name: 'disconnectedAt', type: 'datetime2', isNullable: true },
                    { name: 'isActive', type: 'bit', default: 1 },
                    { name: 'createdAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'updatedAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'createdBy', type: 'uniqueidentifier', isNullable: true },
                    { name: 'updatedBy', type: 'uniqueidentifier', isNullable: true },
                ],
            }),
            true,
        );
        await queryRunner.createIndex('AgentConnections', new TableIndex({
            name: 'IX_AgentConnections_Workstation_Provider',
            columnNames: ['workstationId', 'providerType'],
        }));
        await queryRunner.createForeignKey('AgentConnections', new TableForeignKey({
            name: 'FK_AgentConnections_DeviceAgent',
            columnNames: ['deviceAgentId'],
            referencedTableName: 'DeviceAgents',
            referencedColumnNames: ['id'],
        }));
        await queryRunner.createForeignKey('AgentConnections', new TableForeignKey({
            name: 'FK_AgentConnections_Workstation',
            columnNames: ['workstationId'],
            referencedTableName: 'Workstations',
            referencedColumnNames: ['id'],
        }));

        // 4. UserWorkstationSessions
        await queryRunner.createTable(
            new Table({
                name: 'UserWorkstationSessions',
                columns: [
                    { name: 'id', type: 'uniqueidentifier', isPrimary: true, default: 'NEWSEQUENTIALID()' },
                    { name: 'userId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'workstationId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'userSocketId', type: 'nvarchar(255)', isNullable: false },
                    { name: 'sessionId', type: 'nvarchar(255)', isNullable: true },
                    { name: 'connectedAt', type: 'datetime2', isNullable: false },
                    { name: 'lastSeenAt', type: 'datetime2', isNullable: false },
                    { name: 'disconnectedAt', type: 'datetime2', isNullable: true },
                    { name: 'isActive', type: 'bit', default: 1 },
                    { name: 'createdAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'updatedAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'createdBy', type: 'uniqueidentifier', isNullable: true },
                    { name: 'updatedBy', type: 'uniqueidentifier', isNullable: true },
                ],
            }),
            true,
        );
        await queryRunner.createIndex('UserWorkstationSessions', new TableIndex({
            name: 'IX_UserWorkstationSessions_UserId',
            columnNames: ['userId'],
        }));
        await queryRunner.createIndex('UserWorkstationSessions', new TableIndex({
            name: 'IX_UserWorkstationSessions_Workstation',
            columnNames: ['workstationId'],
        }));
        await queryRunner.createForeignKey('UserWorkstationSessions', new TableForeignKey({
            name: 'FK_UserWorkstationSessions_Workstation',
            columnNames: ['workstationId'],
            referencedTableName: 'Workstations',
            referencedColumnNames: ['id'],
        }));
        await queryRunner.createForeignKey('UserWorkstationSessions', new TableForeignKey({
            name: 'FK_UserWorkstationSessions_User',
            columnNames: ['userId'],
            referencedTableName: 'Users',
            referencedColumnNames: ['id'],
        }));

        // 5. DeviceCommandLogs
        await queryRunner.createTable(
            new Table({
                name: 'DeviceCommandLogs',
                columns: [
                    { name: 'id', type: 'uniqueidentifier', isPrimary: true, default: 'NEWSEQUENTIALID()' },
                    { name: 'requestedByUserId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'workstationId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'providerType', type: 'nvarchar(50)', isNullable: false },
                    { name: 'commandType', type: 'nvarchar(100)', isNullable: false },
                    { name: 'targetAgentId', type: 'uniqueidentifier', isNullable: true },
                    { name: 'correlationId', type: 'nvarchar(255)', isNullable: false },
                    { name: 'status', type: 'nvarchar(50)', default: "'pending'" },
                    { name: 'requestPayloadJson', type: 'nvarchar(MAX)', isNullable: true },
                    { name: 'responsePayloadJson', type: 'nvarchar(MAX)', isNullable: true },
                    { name: 'errorMessage', type: 'nvarchar(MAX)', isNullable: true },
                    { name: 'completedAt', type: 'datetime2', isNullable: true },
                    { name: 'isActive', type: 'bit', default: 1 },
                    { name: 'createdAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'updatedAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'createdBy', type: 'uniqueidentifier', isNullable: true },
                    { name: 'updatedBy', type: 'uniqueidentifier', isNullable: true },
                ],
            }),
            true,
        );
        await queryRunner.createIndex('DeviceCommandLogs', new TableIndex({
            name: 'IX_DeviceCommandLogs_CorrelationId',
            columnNames: ['correlationId'],
        }));
        await queryRunner.createIndex('DeviceCommandLogs', new TableIndex({
            name: 'IX_DeviceCommandLogs_RequestedBy',
            columnNames: ['requestedByUserId'],
        }));
        await queryRunner.createIndex('DeviceCommandLogs', new TableIndex({
            name: 'IX_DeviceCommandLogs_Status',
            columnNames: ['status'],
        }));
        await queryRunner.createForeignKey('DeviceCommandLogs', new TableForeignKey({
            name: 'FK_DeviceCommandLogs_Workstation',
            columnNames: ['workstationId'],
            referencedTableName: 'Workstations',
            referencedColumnNames: ['id'],
        }));
        await queryRunner.createForeignKey('DeviceCommandLogs', new TableForeignKey({
            name: 'FK_DeviceCommandLogs_TargetAgent',
            columnNames: ['targetAgentId'],
            referencedTableName: 'DeviceAgents',
            referencedColumnNames: ['id'],
        }));

        // 6. Seed new permissions
        await queryRunner.query(`
            INSERT INTO Permissions (id, [key], name, description, module, action, isActive, createdAt, updatedAt)
            SELECT NEWID(), v.[key], v.name, v.description, v.module, v.action, 1, GETDATE(), GETDATE()
            FROM (VALUES
                ('visits.print-card', 'Visits Print Card', 'Permission to print-card visits', 'visits', 'print-card'),
                ('devices.read', 'Devices Read', 'Permission to read devices', 'devices', 'read'),
                ('devices.manage', 'Devices Manage', 'Permission to manage devices', 'devices', 'manage'),
                ('scanner.execute', 'Scanner Execute', 'Permission to execute scanner', 'scanner', 'execute')
            ) AS v([key], name, description, module, action)
            WHERE NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.[key] = v.[key])
        `);

        // Assign new permissions to Admin role
        await queryRunner.query(`
            INSERT INTO RolePermissions (roleId, permissionId)
            SELECT r.id, p.id
            FROM Roles r
            CROSS JOIN Permissions p
            WHERE r.name = 'Admin'
              AND p.[key] IN ('visits.print-card', 'devices.read', 'devices.manage', 'scanner.execute')
              AND NOT EXISTS (
                SELECT 1 FROM RolePermissions rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);

        // Assign operational perms to Operator
        await queryRunner.query(`
            INSERT INTO RolePermissions (roleId, permissionId)
            SELECT r.id, p.id
            FROM Roles r
            CROSS JOIN Permissions p
            WHERE r.name = 'Operator'
              AND p.[key] IN ('visits.print-card', 'devices.read', 'scanner.execute')
              AND NOT EXISTS (
                SELECT 1 FROM RolePermissions rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);

        // Assign read perm to Viewer
        await queryRunner.query(`
            INSERT INTO RolePermissions (roleId, permissionId)
            SELECT r.id, p.id
            FROM Roles r
            CROSS JOIN Permissions p
            WHERE r.name = 'Viewer'
              AND p.[key] IN ('devices.read')
              AND NOT EXISTS (
                SELECT 1 FROM RolePermissions rp WHERE rp.roleId = r.id AND rp.permissionId = p.id
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove role-permission assignments
        await queryRunner.query(`
            DELETE rp FROM RolePermissions rp
            INNER JOIN Permissions p ON rp.permissionId = p.id
            WHERE p.[key] IN ('visits.print-card', 'devices.read', 'devices.manage', 'scanner.execute')
        `);

        // Remove permissions
        await queryRunner.query(`
            DELETE FROM Permissions WHERE [key] IN ('visits.print-card', 'devices.read', 'devices.manage', 'scanner.execute')
        `);

        await queryRunner.dropTable('DeviceCommandLogs', true);
        await queryRunner.dropTable('UserWorkstationSessions', true);
        await queryRunner.dropTable('AgentConnections', true);
        await queryRunner.dropTable('DeviceAgents', true);
        await queryRunner.dropTable('Workstations', true);
    }
}
