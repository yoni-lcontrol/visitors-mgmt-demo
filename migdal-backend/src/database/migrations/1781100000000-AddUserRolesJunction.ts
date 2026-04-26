import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRolesJunction1781100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            IF OBJECT_ID(N'[UserRoles]', N'U') IS NULL
            BEGIN
                CREATE TABLE [UserRoles] (
                    [userId] uniqueidentifier NOT NULL,
                    [roleId] uniqueidentifier NOT NULL,
                    CONSTRAINT [PK_UserRoles] PRIMARY KEY ([userId], [roleId]),
                    CONSTRAINT [FK_UserRoles_User] FOREIGN KEY ([userId]) REFERENCES [Users]([id]) ON DELETE CASCADE,
                    CONSTRAINT [FK_UserRoles_Role] FOREIGN KEY ([roleId]) REFERENCES [Roles]([id]) ON DELETE CASCADE
                )
            END
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_UserId' AND object_id = OBJECT_ID('[UserRoles]'))
            BEGIN
                CREATE INDEX [IX_UserRoles_UserId] ON [UserRoles] ([userId])
            END
        `);

        await queryRunner.query(`
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_RoleId' AND object_id = OBJECT_ID('[UserRoles]'))
            BEGIN
                CREATE INDEX [IX_UserRoles_RoleId] ON [UserRoles] ([roleId])
            END
        `);

        await queryRunner.query(`
            INSERT INTO [UserRoles] ([userId], [roleId])
            SELECT u.[id], u.[roleId]
            FROM [Users] u
            WHERE u.[roleId] IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM [UserRoles] ur
                WHERE ur.[userId] = u.[id] AND ur.[roleId] = u.[roleId]
              )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE [UserRoles]`);
    }
}
