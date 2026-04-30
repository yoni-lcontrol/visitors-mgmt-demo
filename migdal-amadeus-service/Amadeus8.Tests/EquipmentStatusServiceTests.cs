using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Amadeus8.Tests;

public class EquipmentStatusServiceTests
{
    [Fact]
    public async Task ChangeStatus_Controller_UpdatesIsActive()
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

        var sut = new EquipmentStatusService(db, NullLogger<EquipmentStatusService>.Instance);

        var result = await sut.ChangeStatusAsync(new EquipmentStatusChangeDto
        {
            ExternalId = "ctrl-1",
            EquipmentType = "controller",
            IsActive = false
        }, CancellationToken.None);

        Assert.True(result.Success);
        var entity = await db.Controllers.AsNoTracking().SingleAsync(c => c.ExternalId == "ctrl-1");
        Assert.False(entity.IsActive);
    }

    [Fact]
    public async Task ChangeStatus_Door_UpdatesIsActive()
    {
        await using var db = CreateDbContext();
        var controller = new ControllerEntity
        {
            ExternalId = "ctrl-1",
            Name = "Controller 1",
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
        db.Controllers.Add(controller);
        await db.SaveChangesAsync();

        db.Doors.Add(new DoorEntity
        {
            ExternalId = "door-1",
            Name = "Door 1",
            ControllerId = controller.Id,
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var sut = new EquipmentStatusService(db, NullLogger<EquipmentStatusService>.Instance);

        var result = await sut.ChangeStatusAsync(new EquipmentStatusChangeDto
        {
            ExternalId = "door-1",
            EquipmentType = "door",
            IsActive = false
        }, CancellationToken.None);

        Assert.True(result.Success);
        var entity = await db.Doors.AsNoTracking().SingleAsync(d => d.ExternalId == "door-1");
        Assert.False(entity.IsActive);
    }

    [Fact]
    public async Task ChangeStatus_AccessLevel_UpdatesIsActive()
    {
        await using var db = CreateDbContext();
        db.AccessLevels.Add(new AccessLevelEntity
        {
            AmadeusUid = "al-uid-1",
            SourceType = "AccessGroup",
            Name = "Level 1",
            ExternalId = "ext-1",
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var sut = new EquipmentStatusService(db, NullLogger<EquipmentStatusService>.Instance);

        var result = await sut.ChangeStatusAsync(new EquipmentStatusChangeDto
        {
            ExternalId = "ext-1",
            EquipmentType = "accesslevel",
            IsActive = false
        }, CancellationToken.None);

        Assert.True(result.Success);
        var entity = await db.AccessLevels.AsNoTracking().SingleAsync(al => al.AmadeusUid == "al-uid-1");
        Assert.False(entity.IsActive);
    }

    [Fact]
    public async Task ChangeStatus_NotFound_ReturnsFailure()
    {
        await using var db = CreateDbContext();

        var sut = new EquipmentStatusService(db, NullLogger<EquipmentStatusService>.Instance);

        var result = await sut.ChangeStatusAsync(new EquipmentStatusChangeDto
        {
            ExternalId = "nonexistent",
            EquipmentType = "controller",
            IsActive = false
        }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("not found", result.ErrorMessage);
    }

    [Fact]
    public async Task ChangeStatus_UnsupportedType_ReturnsFailure()
    {
        await using var db = CreateDbContext();

        var sut = new EquipmentStatusService(db, NullLogger<EquipmentStatusService>.Instance);

        var result = await sut.ChangeStatusAsync(new EquipmentStatusChangeDto
        {
            ExternalId = "x",
            EquipmentType = "unknown",
            IsActive = false
        }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("Unsupported", result.ErrorMessage);
    }

    private static AmadeusDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AmadeusDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AmadeusDbContext(options);
    }
}
