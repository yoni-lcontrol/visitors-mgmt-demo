import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBlockedUntilToBlacklist1784000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'Blacklist',
            new TableColumn({
                name: 'blockedUntil',
                type: 'datetime2',
                isNullable: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('Blacklist', 'blockedUntil');
    }
}
