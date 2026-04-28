using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Amadeus8.Tests;

public class ImportBridgeServiceTests
{
    [Fact]
    public async Task ImportDevicesAsync_WhenDeviceImportFails_DoesNotThrowAndReturnsCurrentTopology()
    {
        await using var db = CreateDbContext();
        db.Controllers.Add(new ControllerEntity
        {
            ExternalId = "ctrl-1",
            Name = "Controller 1",
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var sut = new ImportBridgeService(
            new FailingDeviceImportService(),
            new SuccessAccessImportRoutingService(),
            db,
            NullLogger<ImportBridgeService>.Instance);

        var payload = await sut.ImportDevicesAsync(CancellationToken.None);

        Assert.Single(payload.Controllers);
        Assert.Equal("ctrl-1", payload.Controllers[0].ExternalId);
        Assert.True(payload.Controllers[0].Active);
    }

    [Fact]
    public async Task ImportAccessLevelsAsync_WhenAccessImportFails_DoesNotThrowAndReturnsCurrentLevels()
    {
        await using var db = CreateDbContext();
        db.AccessLevels.Add(new AccessLevelEntity
        {
            AmadeusUid = "al-1",
            SourceType = "AccessGroup",
            Name = "Level 1",
            ExternalId = "ext-al-1",
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var sut = new ImportBridgeService(
            new SuccessDeviceImportService(),
            new FailingAccessImportRoutingService(),
            db,
            NullLogger<ImportBridgeService>.Instance);

        var payload = await sut.ImportAccessLevelsAsync(CancellationToken.None);

        Assert.Single(payload.AccessLevels);
        Assert.Equal("ext-al-1", payload.AccessLevels[0].ExternalId);
        Assert.Equal("Level 1", payload.AccessLevels[0].Name);
    }

    private static AmadeusDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AmadeusDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AmadeusDbContext(options);
    }

    private sealed class FailingDeviceImportService : IDeviceImportService
    {
        public Task<SyncResultDto> ImportAllAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new SyncResultDto
            {
                Operation = "FullSync",
                Success = false,
                ErrorMessage = "Simulated OData paging failure",
                Failed = 1,
                Failures =
                [
                    new ImportFailureDetailDto
                    {
                        EquipmentType = "Controller",
                        ExternalId = "ctrl-x",
                        FailureStage = "fetch",
                        FailureCategory = "unexpected-api-response",
                        Message = "HTTP 400 from /odata/API_Controllers"
                    }
                ]
            });
        }

        public Task<SyncResultDto> ImportControllersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<SyncResultDto> ImportDoorsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<SyncResultDto> ImportExtensionsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
    }

    private sealed class SuccessDeviceImportService : IDeviceImportService
    {
        public Task<SyncResultDto> ImportAllAsync(CancellationToken cancellationToken)
            => Task.FromResult(new SyncResultDto { Operation = "FullSync", Success = true });

        public Task<SyncResultDto> ImportControllersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<SyncResultDto> ImportDoorsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<SyncResultDto> ImportExtensionsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
    }

    private sealed class FailingAccessImportRoutingService : IAccessImportRoutingService
    {
        public Task<SyncResultDto> ImportAsync(AccessImportType importType, CancellationToken cancellationToken)
        {
            return Task.FromResult(new SyncResultDto
            {
                Operation = "ImportAccessLevels",
                Success = false,
                ErrorMessage = "Simulated access-level import failure",
                Failed = 1,
                Failures =
                [
                    new ImportFailureDetailDto
                    {
                        EquipmentType = "AccessLevel",
                        ExternalId = "al-x",
                        FailureStage = "save",
                        FailureCategory = "database-save-update",
                        Message = "Simulated DB failure"
                    }
                ]
            });
        }
    }

    private sealed class SuccessAccessImportRoutingService : IAccessImportRoutingService
    {
        public Task<SyncResultDto> ImportAsync(AccessImportType importType, CancellationToken cancellationToken)
            => Task.FromResult(new SyncResultDto { Operation = "ImportAccessLevels", Success = true });
    }
}
