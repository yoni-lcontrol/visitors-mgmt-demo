import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultCardTemplateToWorkstations1778400000000 implements MigrationInterface {
    name = 'AddDefaultCardTemplateToWorkstations1778400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE Workstations ADD [defaultCardTemplateId] uniqueidentifier NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE Workstations ADD CONSTRAINT [FK_Workstations_CardTemplates] FOREIGN KEY ([defaultCardTemplateId]) REFERENCES [CardTemplates]([id])`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE Workstations DROP CONSTRAINT [FK_Workstations_CardTemplates]`,
        );
        await queryRunner.query(
            `ALTER TABLE Workstations DROP COLUMN [defaultCardTemplateId]`,
        );
    }
}
