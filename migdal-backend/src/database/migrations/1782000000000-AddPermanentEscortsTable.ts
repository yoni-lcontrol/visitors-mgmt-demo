import {
    MigrationInterface,
    QueryRunner,
    Table,
    TableForeignKey,
    TableIndex,
} from 'typeorm';

export class AddPermanentEscortsTable1782000000000 implements MigrationInterface {
    name = 'AddPermanentEscortsTable1782000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await queryRunner.hasTable('PermanentEscorts')) {
            return;
        }

        const isMssql = queryRunner.connection.options.type === 'mssql';
        const idType = isMssql ? 'uniqueidentifier' : 'uuid';
        const idDefault = isMssql ? 'NEWID()' : 'uuid_generate_v4()';

        await queryRunner.createTable(new Table({
            name: 'PermanentEscorts',
            columns: [
                {
                    name: 'id',
                    type: idType,
                    isPrimary: true,
                    default: idDefault,
                },
                {
                    name: 'userId',
                    type: idType,
                    isNullable: false,
                },
                {
                    name: 'createdAt',
                    type: isMssql ? 'datetime2' : 'timestamp',
                    default: isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updatedAt',
                    type: isMssql ? 'datetime2' : 'timestamp',
                    default: isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'createdBy',
                    type: isMssql ? 'nvarchar' : 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'updatedBy',
                    type: isMssql ? 'nvarchar' : 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'isActive',
                    type: isMssql ? 'bit' : 'boolean',
                    default: isMssql ? '1' : 'true',
                },
            ],
        }));

        await queryRunner.createForeignKey('PermanentEscorts', new TableForeignKey({
            name: 'FK_PermanentEscorts_Users',
            columnNames: ['userId'],
            referencedTableName: 'Users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));

        await queryRunner.createIndex('PermanentEscorts', new TableIndex({
            name: 'UQ_PermanentEscorts_userId',
            columnNames: ['userId'],
            isUnique: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('PermanentEscorts')) {
            return;
        }

        const table = await queryRunner.getTable('PermanentEscorts');

        const userFk = table?.foreignKeys.find((foreignKey) => foreignKey.name === 'FK_PermanentEscorts_Users');
        if (userFk) {
            await queryRunner.dropForeignKey('PermanentEscorts', userFk);
        }

        const userIndex = table?.indices.find((index) => index.name === 'UQ_PermanentEscorts_userId');
        if (userIndex) {
            await queryRunner.dropIndex('PermanentEscorts', userIndex);
        }

        await queryRunner.dropTable('PermanentEscorts');
    }
}
