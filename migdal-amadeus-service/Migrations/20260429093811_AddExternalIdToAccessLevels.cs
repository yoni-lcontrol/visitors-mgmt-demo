using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Amadeus8.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalIdToAccessLevels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "AccessLevels",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "AccessLevels");
        }
    }
}
