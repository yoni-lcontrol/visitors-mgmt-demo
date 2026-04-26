import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class EnforceUniqueVisitorPersonId1782100000000 implements MigrationInterface {
    name = 'EnforceUniqueVisitorPersonId1782100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('Visitors')) {
            return;
        }

        const isMssql = queryRunner.connection.options.type === 'mssql';

        await queryRunner.query(
            isMssql
                ? `UPDATE [Visitors] SET [personId] = LTRIM(RTRIM([personId])) WHERE [personId] IS NOT NULL`
                : `UPDATE "Visitors" SET "personId" = TRIM("personId") WHERE "personId" IS NOT NULL`,
        );

        await queryRunner.query(isMssql ? `
            ;WITH RankedVisitors AS (
                SELECT
                    [id],
                    [personId],
                    ROW_NUMBER() OVER (
                        PARTITION BY [personId]
                        ORDER BY
                            CASE WHEN [isActive] = 1 THEN 0 ELSE 1 END,
                            [updatedAt] DESC,
                            [createdAt] DESC,
                            [id] DESC
                    ) AS [rn],
                    FIRST_VALUE([id]) OVER (
                        PARTITION BY [personId]
                        ORDER BY
                            CASE WHEN [isActive] = 1 THEN 0 ELSE 1 END,
                            [updatedAt] DESC,
                            [createdAt] DESC,
                            [id] DESC
                    ) AS [keeperId]
                FROM [Visitors]
                WHERE [personId] IS NOT NULL
                  AND LTRIM(RTRIM([personId])) <> ''
            )
            UPDATE [vv]
            SET [visitorId] = [rv].[keeperId]
            FROM [VisitVisitors] AS [vv]
            INNER JOIN RankedVisitors AS [rv] ON [rv].[id] = [vv].[visitorId]
            WHERE [rv].[rn] > 1
              AND [vv].[visitorId] <> [rv].[keeperId];

            ;WITH RankedVisitors AS (
                SELECT
                    [id],
                    [personId],
                    ROW_NUMBER() OVER (
                        PARTITION BY [personId]
                        ORDER BY
                            CASE WHEN [isActive] = 1 THEN 0 ELSE 1 END,
                            [updatedAt] DESC,
                            [createdAt] DESC,
                            [id] DESC
                    ) AS [rn],
                    FIRST_VALUE([id]) OVER (
                        PARTITION BY [personId]
                        ORDER BY
                            CASE WHEN [isActive] = 1 THEN 0 ELSE 1 END,
                            [updatedAt] DESC,
                            [createdAt] DESC,
                            [id] DESC
                    ) AS [keeperId]
                FROM [Visitors]
                WHERE [personId] IS NOT NULL
                  AND LTRIM(RTRIM([personId])) <> ''
            )
            UPDATE [logs]
            SET [visitorId] = [rv].[keeperId]
            FROM [VisitorAccessLogs] AS [logs]
            INNER JOIN RankedVisitors AS [rv] ON [rv].[id] = [logs].[visitorId]
            WHERE [rv].[rn] > 1
              AND [logs].[visitorId] <> [rv].[keeperId];

            ;WITH RankedVisitors AS (
                SELECT
                    [id],
                    [personId],
                    ROW_NUMBER() OVER (
                        PARTITION BY [personId]
                        ORDER BY
                            CASE WHEN [isActive] = 1 THEN 0 ELSE 1 END,
                            [updatedAt] DESC,
                            [createdAt] DESC,
                            [id] DESC
                    ) AS [rn],
                    FIRST_VALUE([id]) OVER (
                        PARTITION BY [personId]
                        ORDER BY
                            CASE WHEN [isActive] = 1 THEN 0 ELSE 1 END,
                            [updatedAt] DESC,
                            [createdAt] DESC,
                            [id] DESC
                    ) AS [keeperId]
                FROM [Visitors]
                WHERE [personId] IS NOT NULL
                  AND LTRIM(RTRIM([personId])) <> ''
            )
            UPDATE [status]
            SET [visitorId] = [rv].[keeperId]
            FROM [VisitVisitorStatus] AS [status]
            INNER JOIN RankedVisitors AS [rv] ON [rv].[id] = [status].[visitorId]
            WHERE [rv].[rn] > 1
              AND [status].[visitorId] <> [rv].[keeperId];

            ;WITH RankedVisitors AS (
                SELECT
                    [id],
                    ROW_NUMBER() OVER (
                        PARTITION BY [personId]
                        ORDER BY
                            CASE WHEN [isActive] = 1 THEN 0 ELSE 1 END,
                            [updatedAt] DESC,
                            [createdAt] DESC,
                            [id] DESC
                    ) AS [rn]
                FROM [Visitors]
                WHERE [personId] IS NOT NULL
                  AND LTRIM(RTRIM([personId])) <> ''
            )
            DELETE [v]
            FROM [Visitors] AS [v]
            INNER JOIN RankedVisitors AS [rv] ON [rv].[id] = [v].[id]
            WHERE [rv].[rn] > 1;
        ` : `
            WITH ranked_visitors AS (
                SELECT
                    "id",
                    "personId",
                    ROW_NUMBER() OVER (
                        PARTITION BY "personId"
                        ORDER BY
                            CASE WHEN "isActive" THEN 0 ELSE 1 END,
                            "updatedAt" DESC,
                            "createdAt" DESC,
                            "id" DESC
                    ) AS rn,
                    FIRST_VALUE("id") OVER (
                        PARTITION BY "personId"
                        ORDER BY
                            CASE WHEN "isActive" THEN 0 ELSE 1 END,
                            "updatedAt" DESC,
                            "createdAt" DESC,
                            "id" DESC
                    ) AS "keeperId"
                FROM "Visitors"
                WHERE "personId" IS NOT NULL
                  AND TRIM("personId") <> ''
            )
            UPDATE "VisitVisitors" AS vv
            SET "visitorId" = rv."keeperId"
            FROM ranked_visitors AS rv
            WHERE rv."id" = vv."visitorId"
              AND rv.rn > 1
              AND vv."visitorId" <> rv."keeperId";

            WITH ranked_visitors AS (
                SELECT
                    "id",
                    "personId",
                    ROW_NUMBER() OVER (
                        PARTITION BY "personId"
                        ORDER BY
                            CASE WHEN "isActive" THEN 0 ELSE 1 END,
                            "updatedAt" DESC,
                            "createdAt" DESC,
                            "id" DESC
                    ) AS rn,
                    FIRST_VALUE("id") OVER (
                        PARTITION BY "personId"
                        ORDER BY
                            CASE WHEN "isActive" THEN 0 ELSE 1 END,
                            "updatedAt" DESC,
                            "createdAt" DESC,
                            "id" DESC
                    ) AS "keeperId"
                FROM "Visitors"
                WHERE "personId" IS NOT NULL
                  AND TRIM("personId") <> ''
            )
            UPDATE "VisitorAccessLogs" AS logs
            SET "visitorId" = rv."keeperId"
            FROM ranked_visitors AS rv
            WHERE rv."id" = logs."visitorId"
              AND rv.rn > 1
              AND logs."visitorId" <> rv."keeperId";

            WITH ranked_visitors AS (
                SELECT
                    "id",
                    "personId",
                    ROW_NUMBER() OVER (
                        PARTITION BY "personId"
                        ORDER BY
                            CASE WHEN "isActive" THEN 0 ELSE 1 END,
                            "updatedAt" DESC,
                            "createdAt" DESC,
                            "id" DESC
                    ) AS rn,
                    FIRST_VALUE("id") OVER (
                        PARTITION BY "personId"
                        ORDER BY
                            CASE WHEN "isActive" THEN 0 ELSE 1 END,
                            "updatedAt" DESC,
                            "createdAt" DESC,
                            "id" DESC
                    ) AS "keeperId"
                FROM "Visitors"
                WHERE "personId" IS NOT NULL
                  AND TRIM("personId") <> ''
            )
            UPDATE "VisitVisitorStatus" AS status
            SET "visitorId" = rv."keeperId"
            FROM ranked_visitors AS rv
            WHERE rv."id" = status."visitorId"
              AND rv.rn > 1
              AND status."visitorId" <> rv."keeperId";

            WITH ranked_visitors AS (
                SELECT
                    "id",
                    ROW_NUMBER() OVER (
                        PARTITION BY "personId"
                        ORDER BY
                            CASE WHEN "isActive" THEN 0 ELSE 1 END,
                            "updatedAt" DESC,
                            "createdAt" DESC,
                            "id" DESC
                    ) AS rn
                FROM "Visitors"
                WHERE "personId" IS NOT NULL
                  AND TRIM("personId") <> ''
            )
            DELETE FROM "Visitors" AS v
            USING ranked_visitors AS rv
            WHERE rv."id" = v."id"
              AND rv.rn > 1;
        `);

        const visitorsTable = await queryRunner.getTable('Visitors');
        const hasIndex = visitorsTable?.indices.some((index) => index.name === 'UX_Visitors_PersonId') ?? false;
        if (!hasIndex) {
            await queryRunner.createIndex('Visitors', new TableIndex({
                name: 'UX_Visitors_PersonId',
                columnNames: ['personId'],
                isUnique: true,
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('Visitors')) {
            return;
        }

        const visitorsTable = await queryRunner.getTable('Visitors');
        const hasIndex = visitorsTable?.indices.some((index) => index.name === 'UX_Visitors_PersonId') ?? false;
        if (hasIndex) {
            await queryRunner.dropIndex('Visitors', 'UX_Visitors_PersonId');
        }
    }
}