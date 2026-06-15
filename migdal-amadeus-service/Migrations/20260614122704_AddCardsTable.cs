using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Amadeus8.Migrations
{
    /// <inheritdoc />
    public partial class AddCardsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Cards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AmadeusUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    CardholderUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    CardholderIdNumber = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    CardNumber = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    FromDateValidUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ToDateValidUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    IsFromDateActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsToDateActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsDeleted = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cards", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Cards_AmadeusUid",
                table: "Cards",
                column: "AmadeusUid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cards_CardholderIdNumber",
                table: "Cards",
                column: "CardholderIdNumber");

            migrationBuilder.CreateIndex(
                name: "IX_Cards_CardholderUid",
                table: "Cards",
                column: "CardholderUid");

            migrationBuilder.CreateIndex(
                name: "IX_Cards_CardNumber",
                table: "Cards",
                column: "CardNumber");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Cards");
        }
    }
}
