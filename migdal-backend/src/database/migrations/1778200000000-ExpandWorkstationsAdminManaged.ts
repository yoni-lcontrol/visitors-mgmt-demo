import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class ExpandWorkstationsAdminManaged1778200000000 implements MigrationInterface {
    name = 'ExpandWorkstationsAdminManaged1778200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add 'code' and 'description' columns to Workstations
        await queryRunner.query(`ALTER TABLE Workstations ADD [code] nvarchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE Workstations ADD [description] nvarchar(500) NULL`);

        // 2. Make machineId and hostname nullable
        await queryRunner.query(`DROP INDEX IX_Workstations_MachineId ON Workstations`);
        await queryRunner.query(`ALTER TABLE Workstations ALTER COLUMN machineId nvarchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE Workstations ALTER COLUMN hostname nvarchar(255) NULL`);

        // 3. Back-fill code from machineId for existing rows
        await queryRunner.query(`UPDATE Workstations SET [code] = machineId WHERE [code] IS NULL`);

        // 4. Make code NOT NULL and add unique index
        await queryRunner.query(`ALTER TABLE Workstations ALTER COLUMN [code] nvarchar(100) NOT NULL`);
        await queryRunner.createIndex('Workstations', new TableIndex({
            name: 'IX_Workstations_Code',
            columnNames: ['code'],
            isUnique: true,
        }));

        // 5. Re-create machineId unique index with filter for NULLs
        await queryRunner.query(
            `CREATE UNIQUE INDEX IX_Workstations_MachineId ON Workstations (machineId) WHERE machineId IS NOT NULL`,
        );

        // 6. Make displayName NOT NULL (back-fill from code first)
        await queryRunner.query(`UPDATE Workstations SET displayName = [code] WHERE displayName IS NULL`);
        await queryRunner.query(`ALTER TABLE Workstations ALTER COLUMN displayName nvarchar(255) NOT NULL`);

        // 7. WorkstationUsers
        await queryRunner.createTable(
            new Table({
                name: 'WorkstationUsers',
                columns: [
                    { name: 'id', type: 'uniqueidentifier', isPrimary: true, default: 'NEWSEQUENTIALID()' },
                    { name: 'workstationId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'userId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'isActive', type: 'bit', default: 1 },
                    { name: 'createdAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'updatedAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'createdBy', type: 'uniqueidentifier', isNullable: true },
                    { name: 'updatedBy', type: 'uniqueidentifier', isNullable: true },
                ],
            }),
            true,
        );
        await queryRunner.createIndex('WorkstationUsers', new TableIndex({
            name: 'IX_WorkstationUsers_Workstation_User',
            columnNames: ['workstationId', 'userId'],
            isUnique: true,
        }));
        await queryRunner.createIndex('WorkstationUsers', new TableIndex({
            name: 'IX_WorkstationUsers_UserId',
            columnNames: ['userId'],
        }));
        await queryRunner.createForeignKey('WorkstationUsers', new TableForeignKey({
            name: 'FK_WorkstationUsers_Workstation',
            columnNames: ['workstationId'],
            referencedTableName: 'Workstations',
            referencedColumnNames: ['id'],
        }));

        // 8. WorkstationRoles
        await queryRunner.createTable(
            new Table({
                name: 'WorkstationRoles',
                columns: [
                    { name: 'id', type: 'uniqueidentifier', isPrimary: true, default: 'NEWSEQUENTIALID()' },
                    { name: 'workstationId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'roleId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'isActive', type: 'bit', default: 1 },
                    { name: 'createdAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'updatedAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'createdBy', type: 'uniqueidentifier', isNullable: true },
                    { name: 'updatedBy', type: 'uniqueidentifier', isNullable: true },
                ],
            }),
            true,
        );
        await queryRunner.createIndex('WorkstationRoles', new TableIndex({
            name: 'IX_WorkstationRoles_Workstation_Role',
            columnNames: ['workstationId', 'roleId'],
            isUnique: true,
        }));
        await queryRunner.createIndex('WorkstationRoles', new TableIndex({
            name: 'IX_WorkstationRoles_RoleId',
            columnNames: ['roleId'],
        }));
        await queryRunner.createForeignKey('WorkstationRoles', new TableForeignKey({
            name: 'FK_WorkstationRoles_Workstation',
            columnNames: ['workstationId'],
            referencedTableName: 'Workstations',
            referencedColumnNames: ['id'],
        }));

        // 9. WorkstationEnrollmentTokens
        await queryRunner.createTable(
            new Table({
                name: 'WorkstationEnrollmentTokens',
                columns: [
                    { name: 'id', type: 'uniqueidentifier', isPrimary: true, default: 'NEWSEQUENTIALID()' },
                    { name: 'workstationId', type: 'uniqueidentifier', isNullable: false },
                    { name: 'tokenHash', type: 'nvarchar(255)', isNullable: false },
                    { name: 'providerType', type: 'nvarchar(50)', isNullable: false },
                    { name: 'expiresAt', type: 'datetime2', isNullable: false },
                    { name: 'isUsed', type: 'bit', default: 0 },
                    { name: 'usedAt', type: 'datetime2', isNullable: true },
                    { name: 'usedByAgentId', type: 'uniqueidentifier', isNullable: true },
                    { name: 'isActive', type: 'bit', default: 1 },
                    { name: 'createdAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'updatedAt', type: 'datetime2', default: 'GETDATE()' },
                    { name: 'createdBy', type: 'uniqueidentifier', isNullable: true },
                    { name: 'updatedBy', type: 'uniqueidentifier', isNullable: true },
                ],
            }),
            true,
        );
        await queryRunner.createIndex('WorkstationEnrollmentTokens', new TableIndex({
            name: 'IX_WorkstationEnrollmentTokens_TokenHash',
            columnNames: ['tokenHash'],
            isUnique: true,
        }));
        await queryRunner.createIndex('WorkstationEnrollmentTokens', new TableIndex({
            name: 'IX_WorkstationEnrollmentTokens_Workstation',
            columnNames: ['workstationId'],
        }));
        await queryRunner.createForeignKey('WorkstationEnrollmentTokens', new TableForeignKey({
            name: 'FK_WorkstationEnrollmentTokens_Workstation',
            columnNames: ['workstationId'],
            referencedTableName: 'Workstations',
            referencedColumnNames: ['id'],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop new tables
        await queryRunner.dropTable('WorkstationEnrollmentTokens', true);
        await queryRunner.dropTable('WorkstationRoles', true);
        await queryRunner.dropTable('WorkstationUsers', true);

        // Revert Workstations column changes
        await queryRunner.query(`DROP INDEX IX_Workstations_Code ON Workstations`);
        await queryRunner.query(`ALTER TABLE Workstations DROP COLUMN [description]`);
        await queryRunner.query(`ALTER TABLE Workstations DROP COLUMN [code]`);

        // Restore machineId/hostname as NOT NULL
        await queryRunner.query(`DROP INDEX IX_Workstations_MachineId ON Workstations`);
        await queryRunner.query(`UPDATE Workstations SET machineId = 'UNKNOWN' WHERE machineId IS NULL`);
        await queryRunner.query(`ALTER TABLE Workstations ALTER COLUMN machineId nvarchar(255) NOT NULL`);
        await queryRunner.query(`UPDATE Workstations SET hostname = 'UNKNOWN' WHERE hostname IS NULL`);
        await queryRunner.query(`ALTER TABLE Workstations ALTER COLUMN hostname nvarchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE Workstations ALTER COLUMN displayName nvarchar(255) NULL`);
        await queryRunner.createIndex('Workstations', new TableIndex({
            name: 'IX_Workstations_MachineId',
            columnNames: ['machineId'],
            isUnique: true,
        }));
    }
}
