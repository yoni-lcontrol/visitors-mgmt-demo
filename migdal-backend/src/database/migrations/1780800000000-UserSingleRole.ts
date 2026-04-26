import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSingleRole1780800000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add roleId column to Users table
        await queryRunner.query(`
            ALTER TABLE [Users] ADD [roleId] uniqueidentifier NULL
        `);

        // Migrate data: pick one role per user from the junction table
        // (takes the first inserted role if multiple exist)
        await queryRunner.query(`
            UPDATE u
            SET u.[roleId] = ur.[roleId]
            FROM [Users] u
            INNER JOIN (
                SELECT [userId], MIN([roleId]) AS [roleId]
                FROM [UserRoles]
                GROUP BY [userId]
            ) ur ON u.[id] = ur.[userId]
        `);

        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE [Users]
            ADD CONSTRAINT [FK_Users_Role]
            FOREIGN KEY ([roleId]) REFERENCES [Roles]([id])
        `);

        // Create index on roleId
        await queryRunner.query(`
            CREATE INDEX [IX_Users_RoleId] ON [Users] ([roleId])
        `);

        // Drop the junction table
        await queryRunner.query(`DROP TABLE [UserRoles]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate UserRoles junction table
        await queryRunner.query(`
            CREATE TABLE [UserRoles] (
                [userId] uniqueidentifier NOT NULL,
                [roleId] uniqueidentifier NOT NULL,
                CONSTRAINT [PK_UserRoles] PRIMARY KEY ([userId], [roleId]),
                CONSTRAINT [FK_UserRoles_User] FOREIGN KEY ([userId]) REFERENCES [Users]([id]) ON DELETE CASCADE,
                CONSTRAINT [FK_UserRoles_Role] FOREIGN KEY ([roleId]) REFERENCES [Roles]([id]) ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_UserRoles_UserId] ON [UserRoles] ([userId])
        `);

        await queryRunner.query(`
            CREATE INDEX [IX_UserRoles_RoleId] ON [UserRoles] ([roleId])
        `);

        // Migrate data back from roleId column
        await queryRunner.query(`
            INSERT INTO [UserRoles] ([userId], [roleId])
            SELECT [id], [roleId] FROM [Users] WHERE [roleId] IS NOT NULL
        `);

        // Drop FK and index
        await queryRunner.query(`DROP INDEX [IX_Users_RoleId] ON [Users]`);
        await queryRunner.query(`ALTER TABLE [Users] DROP CONSTRAINT [FK_Users_Role]`);
        await queryRunner.query(`ALTER TABLE [Users] DROP COLUMN [roleId]`);
    }
}
