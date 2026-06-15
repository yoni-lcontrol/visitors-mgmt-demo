import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBadgeToUsers1784600000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'Users',
            new TableColumn({
                name: 'badge',
                type: 'nvarchar',
                length: '50',
                isNullable: true,
                default: null,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('Users', 'badge');
    }
}
