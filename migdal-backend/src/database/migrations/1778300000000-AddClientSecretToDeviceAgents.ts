import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientSecretToDeviceAgents1778300000000 implements MigrationInterface {
    name = 'AddClientSecretToDeviceAgents1778300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE DeviceAgents ADD [clientSecret] nvarchar(512) NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE DeviceAgents DROP COLUMN [clientSecret]`,
        );
    }
}
