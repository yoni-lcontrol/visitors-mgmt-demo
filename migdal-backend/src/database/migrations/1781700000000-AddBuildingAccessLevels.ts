import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddBuildingAccessLevels1781700000000 implements MigrationInterface {
    name = 'AddBuildingAccessLevels1781700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('BuildingAccessLevels')) {
            return;
        }

        const isMssql = queryRunner.connection.options.type === 'mssql';
        const idType = isMssql ? 'uniqueidentifier' : 'uuid';

        await queryRunner.createTable(new Table({
            name: 'BuildingAccessLevels',
            columns: [
                {
                    name: 'buildingId',
                    type: idType,
                    isNullable: false,
                    isPrimary: true,
                },
                {
                    name: 'accessLevelId',
                    type: idType,
                    isNullable: false,
                    isPrimary: true,
                },
            ],
        }));

        await queryRunner.createForeignKeys('BuildingAccessLevels', [
            new TableForeignKey({
                name: 'FK_BuildingAccessLevels_Building',
                columnNames: ['buildingId'],
                referencedTableName: 'Buildings',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
            new TableForeignKey({
                name: 'FK_BuildingAccessLevels_AccessLevel',
                columnNames: ['accessLevelId'],
                referencedTableName: 'AccessLevels',
                referencedColumnNames: ['id'],
                onDelete: 'NO ACTION',
            }),
        ]);

        await queryRunner.createIndex('BuildingAccessLevels', new TableIndex({
            name: 'IX_BuildingAccessLevels_AccessLevelId',
            columnNames: ['accessLevelId'],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('BuildingAccessLevels')) {
            return;
        }

        const table = await queryRunner.getTable('BuildingAccessLevels');
        const buildingFk = table?.foreignKeys.find((fk) => fk.name === 'FK_BuildingAccessLevels_Building');
        if (buildingFk) {
            await queryRunner.dropForeignKey('BuildingAccessLevels', buildingFk);
        }

        const accessLevelFk = table?.foreignKeys.find((fk) => fk.name === 'FK_BuildingAccessLevels_AccessLevel');
        if (accessLevelFk) {
            await queryRunner.dropForeignKey('BuildingAccessLevels', accessLevelFk);
        }

        const accessLevelIndex = table?.indices.find((index) => index.name === 'IX_BuildingAccessLevels_AccessLevelId');
        if (accessLevelIndex) {
            await queryRunner.dropIndex('BuildingAccessLevels', accessLevelIndex);
        }

        await queryRunner.dropTable('BuildingAccessLevels');
    }
}
