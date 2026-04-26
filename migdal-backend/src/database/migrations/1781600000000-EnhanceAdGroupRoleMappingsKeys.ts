import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class EnhanceAdGroupRoleMappingsKeys1781600000000 implements MigrationInterface {
    name = 'EnhanceAdGroupRoleMappingsKeys1781600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('AdGroupRoleMappings')) {
            return;
        }

        const dbType = queryRunner.connection.options.type;
        const isMssql = dbType === 'mssql';

        const table = await queryRunner.getTable('AdGroupRoleMappings');
        if (!table) {
            return;
        }

        if (!table.columns.some((column) => column.name === 'adSourceId')) {
            await queryRunner.addColumn('AdGroupRoleMappings', new TableColumn({
                name: 'adSourceId',
                type: isMssql ? 'uniqueidentifier' : 'uuid',
                isNullable: true,
            }));
        }

        if (!table.columns.some((column) => column.name === 'groupExternalId')) {
            await queryRunner.addColumn('AdGroupRoleMappings', new TableColumn({
                name: 'groupExternalId',
                type: isMssql ? 'nvarchar' : 'varchar',
                length: '255',
                isNullable: true,
            }));
        }

        const refreshed = await queryRunner.getTable('AdGroupRoleMappings');
        const existingUniqueOnGroupName = refreshed?.uniques.find(
            (unique) => unique.columnNames.length === 1 && unique.columnNames[0] === 'groupName',
        );
        if (existingUniqueOnGroupName) {
            await queryRunner.dropUniqueConstraint('AdGroupRoleMappings', existingUniqueOnGroupName);
        }

        const oldGroupNameIndex = refreshed?.indices.find((idx) => idx.name === 'IX_AdGroupRoleMappings_GroupName');
        if (oldGroupNameIndex) {
            await queryRunner.dropIndex('AdGroupRoleMappings', oldGroupNameIndex);
        }

        await queryRunner.createIndex('AdGroupRoleMappings', new TableIndex({
            name: 'IX_AdGroupRoleMappings_GroupName',
            columnNames: ['groupName'],
        }));

        await queryRunner.createIndex('AdGroupRoleMappings', new TableIndex({
            name: 'UX_AdGroupRoleMappings_Source_GroupName',
            columnNames: ['adSourceId', 'groupName'],
            isUnique: true,
        }));

        if (isMssql) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX [UX_AdGroupRoleMappings_Source_GroupExternalId]
                ON [AdGroupRoleMappings] ([adSourceId], [groupExternalId])
                WHERE [groupExternalId] IS NOT NULL
            `);
        } else {
            await queryRunner.createIndex('AdGroupRoleMappings', new TableIndex({
                name: 'UX_AdGroupRoleMappings_Source_GroupExternalId',
                columnNames: ['adSourceId', 'groupExternalId'],
                isUnique: true,
            }));
        }

        await queryRunner.createIndex('AdGroupRoleMappings', new TableIndex({
            name: 'IX_AdGroupRoleMappings_AdSourceId',
            columnNames: ['adSourceId'],
        }));

        const latestTable = await queryRunner.getTable('AdGroupRoleMappings');
        const existingAdSourceFk = latestTable?.foreignKeys.find((fk) => fk.name === 'FK_AdGroupRoleMappings_AdSource');
        if (!existingAdSourceFk) {
            await queryRunner.createForeignKey('AdGroupRoleMappings', new TableForeignKey({
                name: 'FK_AdGroupRoleMappings_AdSource',
                columnNames: ['adSourceId'],
                referencedTableName: 'AdConfigurations',
                referencedColumnNames: ['id'],
                onDelete: 'NO ACTION',
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('AdGroupRoleMappings')) {
            return;
        }

        const dbType = queryRunner.connection.options.type;
        const isMssql = dbType === 'mssql';

        const table = await queryRunner.getTable('AdGroupRoleMappings');
        const adSourceFk = table?.foreignKeys.find((fk) => fk.name === 'FK_AdGroupRoleMappings_AdSource');
        if (adSourceFk) {
            await queryRunner.dropForeignKey('AdGroupRoleMappings', adSourceFk);
        }

        const adSourceIdx = table?.indices.find((idx) => idx.name === 'IX_AdGroupRoleMappings_AdSourceId');
        if (adSourceIdx) {
            await queryRunner.dropIndex('AdGroupRoleMappings', adSourceIdx);
        }

        if (isMssql) {
            await queryRunner.query(`
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_AdGroupRoleMappings_Source_GroupExternalId' AND object_id = OBJECT_ID('AdGroupRoleMappings'))
                DROP INDEX [UX_AdGroupRoleMappings_Source_GroupExternalId] ON [AdGroupRoleMappings]
            `);
        } else {
            const externalIdIdx = table?.indices.find((idx) => idx.name === 'UX_AdGroupRoleMappings_Source_GroupExternalId');
            if (externalIdIdx) {
                await queryRunner.dropIndex('AdGroupRoleMappings', externalIdIdx);
            }
        }

        const sourceGroupNameIdx = table?.indices.find((idx) => idx.name === 'UX_AdGroupRoleMappings_Source_GroupName');
        if (sourceGroupNameIdx) {
            await queryRunner.dropIndex('AdGroupRoleMappings', sourceGroupNameIdx);
        }

        const groupNameIdx = table?.indices.find((idx) => idx.name === 'IX_AdGroupRoleMappings_GroupName');
        if (groupNameIdx) {
            await queryRunner.dropIndex('AdGroupRoleMappings', groupNameIdx);
        }

        await queryRunner.createIndex('AdGroupRoleMappings', new TableIndex({
            name: 'IX_AdGroupRoleMappings_GroupName',
            columnNames: ['groupName'],
            isUnique: true,
        }));

        const refreshed = await queryRunner.getTable('AdGroupRoleMappings');
        if (refreshed?.columns.some((column) => column.name === 'groupExternalId')) {
            await queryRunner.dropColumn('AdGroupRoleMappings', 'groupExternalId');
        }
        if (refreshed?.columns.some((column) => column.name === 'adSourceId')) {
            await queryRunner.dropColumn('AdGroupRoleMappings', 'adSourceId');
        }
    }
}
