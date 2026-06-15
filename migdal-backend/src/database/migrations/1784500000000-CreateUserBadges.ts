import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUserBadges1784500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'UserBadges',
                columns: [
                    {
                        name: 'id',
                        type: 'uniqueidentifier',
                        isPrimary: true,
                        default: 'NEWID()',
                    },
                    {
                        name: 'userId',
                        type: 'uniqueidentifier',
                        isNullable: false,
                    },
                    {
                        name: 'amadeusCardUid',
                        type: 'nvarchar',
                        length: '256',
                        isNullable: false,
                    },
                    {
                        name: 'cardNumber',
                        type: 'nvarchar',
                        length: '256',
                        isNullable: true,
                    },
                    {
                        name: 'cardholderIdNumber',
                        type: 'nvarchar',
                        length: '256',
                        isNullable: true,
                    },
                    {
                        name: 'amadeusCardholderUid',
                        type: 'nvarchar',
                        length: '256',
                        isNullable: true,
                    },
                    {
                        name: 'status',
                        type: 'nvarchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'validFrom',
                        type: 'datetime2',
                        isNullable: true,
                    },
                    {
                        name: 'validTo',
                        type: 'datetime2',
                        isNullable: true,
                    },
                    {
                        name: 'lastSyncedAt',
                        type: 'datetime2',
                        isNullable: true,
                    },
                    {
                        name: 'isActive',
                        type: 'bit',
                        default: 1,
                    },
                    {
                        name: 'createdAt',
                        type: 'datetime2',
                        default: 'GETUTCDATE()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'datetime2',
                        default: 'GETUTCDATE()',
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
                ],
                foreignKeys: [
                    {
                        columnNames: ['userId'],
                        referencedTableName: 'Users',
                        referencedColumnNames: ['id'],
                        onDelete: 'CASCADE',
                    },
                ],
            }),
            true,
        );

        await queryRunner.createIndex(
            'UserBadges',
            new TableIndex({ name: 'IDX_UserBadges_amadeusCardUid', columnNames: ['amadeusCardUid'], isUnique: true }),
        );

        await queryRunner.createIndex(
            'UserBadges',
            new TableIndex({ name: 'IDX_UserBadges_userId', columnNames: ['userId'] }),
        );

        await queryRunner.createIndex(
            'UserBadges',
            new TableIndex({ name: 'IDX_UserBadges_cardholderIdNumber', columnNames: ['cardholderIdNumber'] }),
        );

        await queryRunner.createIndex(
            'UserBadges',
            new TableIndex({ name: 'IDX_UserBadges_cardNumber', columnNames: ['cardNumber'] }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('UserBadges', true);
    }
}
