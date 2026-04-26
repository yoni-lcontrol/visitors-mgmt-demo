import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddAdGroupRoleMappingsTable1781400000000 implements MigrationInterface {
    name = 'AddAdGroupRoleMappingsTable1781400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('AdGroupRoleMappings')) {
            return;
        }

        const dbType = queryRunner.connection.options.type;
        const isMssql = dbType === 'mssql';
        const isPostgres = dbType === 'postgres';

        const uuidType = isMssql ? 'uniqueidentifier' : (isPostgres ? 'uuid' : 'varchar');
        const dateType = isMssql ? 'datetime2' : (isPostgres ? 'timestamp' : 'datetime');

        await queryRunner.createTable(new Table({
            name: 'AdGroupRoleMappings',
            columns: [
                {
                    name: 'id',
                    type: 'bigint',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment',
                },
                {
                    name: 'groupName',
                    type: isMssql ? 'nvarchar' : 'varchar',
                    length: '255',
                    isNullable: false,
                    isUnique: true,
                },
                {
                    name: 'roleId',
                    type: uuidType,
                    length: uuidType === 'varchar' ? '36' : undefined,
                    isNullable: false,
                },
                {
                    name: 'createdAt',
                    type: dateType,
                    default: isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updatedAt',
                    type: dateType,
                    default: isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP',
                    onUpdate: isMssql ? undefined : 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'createdBy',
                    type: uuidType,
                    length: uuidType === 'varchar' ? '36' : undefined,
                    isNullable: true,
                },
                {
                    name: 'updatedBy',
                    type: uuidType,
                    length: uuidType === 'varchar' ? '36' : undefined,
                    isNullable: true,
                },
            ],
        }));

        await queryRunner.createIndex('AdGroupRoleMappings', new TableIndex({
            name: 'IX_AdGroupRoleMappings_GroupName',
            columnNames: ['groupName'],
            isUnique: true,
        }));

        await queryRunner.createIndex('AdGroupRoleMappings', new TableIndex({
            name: 'IX_AdGroupRoleMappings_RoleId',
            columnNames: ['roleId'],
        }));

        await queryRunner.createForeignKey('AdGroupRoleMappings', new TableForeignKey({
            name: 'FK_AdGroupRoleMappings_Role',
            columnNames: ['roleId'],
            referencedTableName: 'Roles',
            referencedColumnNames: ['id'],
            onDelete: 'NO ACTION',
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('AdGroupRoleMappings')) {
            return;
        }

        const table = await queryRunner.getTable('AdGroupRoleMappings');
        const roleFk = table?.foreignKeys.find((fk) => fk.name === 'FK_AdGroupRoleMappings_Role');
        if (roleFk) {
            await queryRunner.dropForeignKey('AdGroupRoleMappings', roleFk);
        }

        const groupNameIndex = table?.indices.find((idx) => idx.name === 'IX_AdGroupRoleMappings_GroupName');
        if (groupNameIndex) {
            await queryRunner.dropIndex('AdGroupRoleMappings', groupNameIndex);
        }

        const roleIndex = table?.indices.find((idx) => idx.name === 'IX_AdGroupRoleMappings_RoleId');
        if (roleIndex) {
            await queryRunner.dropIndex('AdGroupRoleMappings', roleIndex);
        }

        await queryRunner.dropTable('AdGroupRoleMappings');
    }
}
