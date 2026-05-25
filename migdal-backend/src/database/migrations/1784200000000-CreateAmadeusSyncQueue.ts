import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAmadeusSyncQueue1784200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'AmadeusSyncQueue',
                columns: [
                    {
                        name: 'id',
                        type: 'uniqueidentifier',
                        isPrimary: true,
                        default: 'NEWSEQUENTIALID()',
                    },
                    {
                        name: 'operation',
                        type: 'nvarchar',
                        length: '30',
                    },
                    {
                        name: 'source',
                        type: 'nvarchar',
                        length: '30',
                    },
                    {
                        name: 'status',
                        type: 'nvarchar',
                        length: '20',
                        default: "'pending'",
                    },
                    {
                        name: 'payload',
                        type: 'nvarchar(MAX)',
                    },
                    {
                        name: 'personId',
                        type: 'nvarchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'cardholderId',
                        type: 'nvarchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'errorMessage',
                        type: 'nvarchar',
                        length: '500',
                        isNullable: true,
                    },
                    {
                        name: 'retryCount',
                        type: 'int',
                        default: 0,
                    },
                    {
                        name: 'maxRetries',
                        type: 'int',
                        default: 10,
                    },
                    {
                        name: 'nextRetryAt',
                        type: 'datetime2',
                        isNullable: true,
                    },
                    {
                        name: 'completedAt',
                        type: 'datetime2',
                        isNullable: true,
                    },
                    {
                        name: 'referenceId',
                        type: 'nvarchar',
                        length: '500',
                        isNullable: true,
                    },
                    {
                        name: 'referenceType',
                        type: 'nvarchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'datetime2',
                        default: 'GETDATE()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'datetime2',
                        default: 'GETDATE()',
                    },
                    {
                        name: 'createdBy',
                        type: 'uniqueidentifier',
                        isNullable: true,
                    },
                    {
                        name: 'updatedBy',
                        type: 'uniqueidentifier',
                        isNullable: true,
                    },
                    {
                        name: 'isActive',
                        type: 'bit',
                        default: 1,
                    },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'AmadeusSyncQueue',
            new TableIndex({
                name: 'IDX_AMADEUS_SYNC_QUEUE_STATUS_RETRY',
                columnNames: ['status', 'nextRetryAt'],
            }),
        );

        await queryRunner.createIndex(
            'AmadeusSyncQueue',
            new TableIndex({
                name: 'IDX_AMADEUS_SYNC_QUEUE_PERSON_ID',
                columnNames: ['personId'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('AmadeusSyncQueue', 'IDX_AMADEUS_SYNC_QUEUE_PERSON_ID');
        await queryRunner.dropIndex('AmadeusSyncQueue', 'IDX_AMADEUS_SYNC_QUEUE_STATUS_RETRY');
        await queryRunner.dropTable('AmadeusSyncQueue');
    }
}
