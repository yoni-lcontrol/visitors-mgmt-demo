import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVisitRequesterUserId1779200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add visitRequesterUserId column
        await queryRunner.query(`
            ALTER TABLE Visits ADD visitRequesterUserId UNIQUEIDENTIFIER NULL;
        `);

        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE Visits ADD CONSTRAINT FK_Visits_VisitRequesterUser
            FOREIGN KEY (visitRequesterUserId) REFERENCES Users(id);
        `);

        // Backfill: set visitRequesterUserId = createdByUserId where requester name matches
        // the creating user, then clear the snapshot fields for those rows
        await queryRunner.query(`
            UPDATE v
            SET v.visitRequesterUserId = v.createdByUserId,
                v.visitRequesterFirstName = NULL,
                v.visitRequesterLastName = NULL,
                v.visitRequesterPhone = NULL,
                v.visitRequesterEmail = NULL
            FROM Visits v
            INNER JOIN Users u ON u.id = v.createdByUserId
            WHERE v.visitRequesterFirstName = u.firstName
              AND v.visitRequesterLastName = u.lastName;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore snapshot fields from user data before dropping column
        await queryRunner.query(`
            UPDATE v
            SET v.visitRequesterFirstName = u.firstName,
                v.visitRequesterLastName = u.lastName,
                v.visitRequesterPhone = ISNULL(u.phone, ''),
                v.visitRequesterEmail = ISNULL(u.email, '')
            FROM Visits v
            INNER JOIN Users u ON u.id = v.visitRequesterUserId
            WHERE v.visitRequesterUserId IS NOT NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE Visits DROP CONSTRAINT FK_Visits_VisitRequesterUser;
        `);

        await queryRunner.query(`
            ALTER TABLE Visits DROP COLUMN visitRequesterUserId;
        `);
    }
}
