import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalIdToBuildingAccessLevels1746611012000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [BuildingAccessLevels] ADD [accessLevelExternalId] NVARCHAR(200) NULL`,
        );

        // Back-fill from the AccessLevels table
        await queryRunner.query(
            `UPDATE bal
             SET bal.accessLevelExternalId = al.externalId
             FROM [BuildingAccessLevels] bal
             INNER JOIN [AccessLevels] al ON al.id = bal.accessLevelId`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE [BuildingAccessLevels] DROP COLUMN [accessLevelExternalId]`,
        );
    }
}
