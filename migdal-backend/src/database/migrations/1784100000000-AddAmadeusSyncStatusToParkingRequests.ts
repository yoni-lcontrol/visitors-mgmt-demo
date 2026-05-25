import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAmadeusSyncStatusToParkingRequests1784100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'ParkingRequests',
            new TableColumn({
                name: 'amadeusSyncStatus',
                type: 'nvarchar',
                length: '20',
                isNullable: true,
                default: null,
            }),
        );
        await queryRunner.addColumn(
            'ParkingRequests',
            new TableColumn({
                name: 'amadeusSyncMessage',
                type: 'nvarchar',
                length: '500',
                isNullable: true,
                default: null,
            }),
        );
        await queryRunner.addColumn(
            'ParkingRequests',
            new TableColumn({
                name: 'amadeusSyncedAt',
                type: 'datetime2',
                isNullable: true,
                default: null,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('ParkingRequests', 'amadeusSyncedAt');
        await queryRunner.dropColumn('ParkingRequests', 'amadeusSyncMessage');
        await queryRunner.dropColumn('ParkingRequests', 'amadeusSyncStatus');
    }
}
