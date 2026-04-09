import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDeviceConnectedToDeviceAgents1780300000000
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'DeviceAgents',
            new TableColumn({
                name: 'deviceConnected',
                type: 'bit',
                isNullable: true,
                default: null,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('DeviceAgents', 'deviceConnected');
    }
}
