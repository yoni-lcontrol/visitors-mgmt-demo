using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Amadeus8.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccessGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AmadeusUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AccessLevels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AmadeusUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    SourceType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    ExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccessLevels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Cardholders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AmadeusUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    CardholderIdNumber = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    FirstName = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    LastName = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    CardholderTypeUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    DepartmentUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    FromDateValidUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ToDateValidUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    IsFromDateActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsToDateActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    SecurityGroupUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    SecurityGroupApiKey = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    AccessGroupUidsRaw = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: true),
                    AccessGroupApiKeysRaw = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: true),
                    LastDownloadTimeUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    IsDeleted = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsArchived = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cardholders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Controllers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ExternalApiKey = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    SiteExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastCommunicationStatus = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Controllers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EventLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SourceSystem = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    ExternalEventId = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    EventType = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    EventCategory = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    SourceEventUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ReceivedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ControllerExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    ObjectExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    RawPayloadJson = table.Column<string>(type: "TEXT", nullable: true),
                    ProcessingStatus = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProcessingError = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SecurityGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AmadeusUid = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Doors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    ControllerId = table.Column<int>(type: "INTEGER", nullable: false),
                    ReaderExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    PrimaryOutputExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    DoorContactInputExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Doors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Doors_Controllers_ControllerId",
                        column: x => x.ControllerId,
                        principalTable: "Controllers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Extensions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ControllerId = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    ModuleType = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Extensions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Extensions_Controllers_ControllerId",
                        column: x => x.ControllerId,
                        principalTable: "Controllers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DoorIos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    DoorId = table.Column<int>(type: "INTEGER", nullable: false),
                    ControllerId = table.Column<int>(type: "INTEGER", nullable: false),
                    IoType = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Direction = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoorIos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DoorIos_Controllers_ControllerId",
                        column: x => x.ControllerId,
                        principalTable: "Controllers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DoorIos_Doors_DoorId",
                        column: x => x.DoorId,
                        principalTable: "Doors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExtensionIos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ExternalId = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ExtensionId = table.Column<int>(type: "INTEGER", nullable: false),
                    ControllerId = table.Column<int>(type: "INTEGER", nullable: false),
                    IoType = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Direction = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExtensionIos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExtensionIos_Controllers_ControllerId",
                        column: x => x.ControllerId,
                        principalTable: "Controllers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ExtensionIos_Extensions_ExtensionId",
                        column: x => x.ExtensionId,
                        principalTable: "Extensions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccessGroups_AmadeusUid",
                table: "AccessGroups",
                column: "AmadeusUid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AccessGroups_ApiKey",
                table: "AccessGroups",
                column: "ApiKey");

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

            migrationBuilder.CreateIndex(
                name: "IX_Cardholders_AmadeusUid",
                table: "Cardholders",
                column: "AmadeusUid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cardholders_CardholderIdNumber",
                table: "Cardholders",
                column: "CardholderIdNumber");

            migrationBuilder.CreateIndex(
                name: "IX_Cardholders_SecurityGroupUid",
                table: "Cardholders",
                column: "SecurityGroupUid");

            migrationBuilder.CreateIndex(
                name: "IX_Cardholders_Status",
                table: "Cardholders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Controllers_ExternalApiKey",
                table: "Controllers",
                column: "ExternalApiKey");

            migrationBuilder.CreateIndex(
                name: "IX_Controllers_ExternalId",
                table: "Controllers",
                column: "ExternalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DoorIos_ControllerId",
                table: "DoorIos",
                column: "ControllerId");

            migrationBuilder.CreateIndex(
                name: "IX_DoorIos_DoorId",
                table: "DoorIos",
                column: "DoorId");

            migrationBuilder.CreateIndex(
                name: "IX_DoorIos_ExternalId",
                table: "DoorIos",
                column: "ExternalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Doors_ControllerId",
                table: "Doors",
                column: "ControllerId");

            migrationBuilder.CreateIndex(
                name: "IX_Doors_ExternalId",
                table: "Doors",
                column: "ExternalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventLogs_ControllerExternalId",
                table: "EventLogs",
                column: "ControllerExternalId");

            migrationBuilder.CreateIndex(
                name: "IX_EventLogs_EventType",
                table: "EventLogs",
                column: "EventType");

            migrationBuilder.CreateIndex(
                name: "IX_EventLogs_ExternalEventId",
                table: "EventLogs",
                column: "ExternalEventId");

            migrationBuilder.CreateIndex(
                name: "IX_EventLogs_ReceivedUtc",
                table: "EventLogs",
                column: "ReceivedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_EventLogs_SourceEventUtc",
                table: "EventLogs",
                column: "SourceEventUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionIos_ControllerId",
                table: "ExtensionIos",
                column: "ControllerId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionIos_ExtensionId",
                table: "ExtensionIos",
                column: "ExtensionId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtensionIos_ExternalId",
                table: "ExtensionIos",
                column: "ExternalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Extensions_ControllerId",
                table: "Extensions",
                column: "ControllerId");

            migrationBuilder.CreateIndex(
                name: "IX_Extensions_ExternalId",
                table: "Extensions",
                column: "ExternalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SecurityGroups_AmadeusUid",
                table: "SecurityGroups",
                column: "AmadeusUid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SecurityGroups_ApiKey",
                table: "SecurityGroups",
                column: "ApiKey");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccessGroups");

            migrationBuilder.DropTable(
                name: "AccessLevels");

            migrationBuilder.DropTable(
                name: "Cardholders");

            migrationBuilder.DropTable(
                name: "DoorIos");

            migrationBuilder.DropTable(
                name: "EventLogs");

            migrationBuilder.DropTable(
                name: "ExtensionIos");

            migrationBuilder.DropTable(
                name: "SecurityGroups");

            migrationBuilder.DropTable(
                name: "Doors");

            migrationBuilder.DropTable(
                name: "Extensions");

            migrationBuilder.DropTable(
                name: "Controllers");
        }
    }
}
