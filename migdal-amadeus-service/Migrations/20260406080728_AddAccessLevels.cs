using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Amadeus8.Migrations
{
    /// <inheritdoc />
    public partial class AddAccessLevels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccessLevels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AmadeusUid = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    SourceType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ApiKey = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Name = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessLevels", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccessLevels_ApiKey",
                table: "AccessLevels",
                column: "ApiKey");

            migrationBuilder.CreateIndex(
                name: "IX_AccessLevels_IsActive",
                table: "AccessLevels",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_AccessLevels_SourceType_AmadeusUid",
                table: "AccessLevels",
                columns: new[] { "SourceType", "AmadeusUid" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccessLevels");
        }
    }
}
