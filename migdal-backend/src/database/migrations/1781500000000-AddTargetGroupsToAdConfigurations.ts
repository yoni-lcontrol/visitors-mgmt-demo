import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTargetGroupsToAdConfigurations1781500000000 implements MigrationInterface {
    name = 'AddTargetGroupsToAdConfigurations1781500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('AdConfigurations');
        if (!table) {
            return;
        }

        const hasColumn = table.columns.some((column) => column.name === 'targetGroupsJson');
        if (hasColumn) {
            return;
        }

        await queryRunner.addColumn(
            'AdConfigurations',
            new TableColumn({
                name: 'targetGroupsJson',
                type: queryRunner.connection.options.type === 'mssql' ? 'nvarchar' : 'varchar',
                length: queryRunner.connection.options.type === 'mssql' ? 'MAX' : '4000',
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('AdConfigurations');
        if (!table) {
            return;
        }

        const hasColumn = table.columns.some((column) => column.name === 'targetGroupsJson');
        if (!hasColumn) {
            return;
        }

        await queryRunner.dropColumn('AdConfigurations', 'targetGroupsJson');
    }
}
