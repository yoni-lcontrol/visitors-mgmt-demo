import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveManualRequesterFieldsFromVisits1784700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('Visits', 'visitRequesterFirstName');
        await queryRunner.dropColumn('Visits', 'visitRequesterLastName');
        await queryRunner.dropColumn('Visits', 'visitRequesterPhone');
        await queryRunner.dropColumn('Visits', 'visitRequesterEmail');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE [Visits] ADD [visitRequesterFirstName] nvarchar(200) NULL`);
        await queryRunner.query(`ALTER TABLE [Visits] ADD [visitRequesterLastName] nvarchar(200) NULL`);
        await queryRunner.query(`ALTER TABLE [Visits] ADD [visitRequesterPhone] nvarchar(50) NULL`);
        await queryRunner.query(`ALTER TABLE [Visits] ADD [visitRequesterEmail] nvarchar(320) NULL`);
    }
}
