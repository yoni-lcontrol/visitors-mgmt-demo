using Amadeus8.Data;
using Amadeus8.Entities;
using Amadeus8.Models;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Amadeus8.Tests;

/// <summary>
/// Unit tests for <see cref="EquipmentResolverService"/>.
/// Uses an EF Core InMemory database to avoid any real SQL Server dependency.
/// </summary>
public sealed class EquipmentResolverServiceTests : IDisposable
{
    // ── shared infrastructure ─────────────────────────────────────────────────

    private readonly AmadeusDbContext _db;
    private readonly EquipmentResolverService _sut;

    public EquipmentResolverServiceTests()
    {
        var options = new DbContextOptionsBuilder<AmadeusDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()) // isolated per test class instance
            .Options;

        _db = new AmadeusDbContext(options);
        _sut = new EquipmentResolverService(_db, NullLogger<EquipmentResolverService>.Instance);
    }

    public void Dispose() => _db.Dispose();

    // ── helper ────────────────────────────────────────────────────────────────

    private static AmadeusEventContext MakeContext(string? readerUid, string method = "AccessEventArrived") =>
        new()
        {
            SignalRMethodName = method,
            ReaderUid         = readerUid,
            EventUid          = Guid.NewGuid().ToString()
        };

    private static ControllerEntity MakeController(string externalId = "ctrl-1") =>
        new()
        {
            ExternalId  = externalId,
            Name        = "Test Controller",
            CreatedUtc  = DateTime.UtcNow,
            UpdatedUtc  = DateTime.UtcNow,
            IsActive    = true
        };

    // ── ResolveAsync via ReaderExternalId ─────────────────────────────────────

    [Fact]
    public async Task Resolve_ReaderUidMatchesDoorReaderExternalId_ActiveDoor_ReturnsShouldForwardTrue()
    {
        // Arrange
        var readerUid = Guid.NewGuid().ToString();
        var controller = MakeController();
        _db.Controllers.Add(controller);
        await _db.SaveChangesAsync();

        _db.Doors.Add(new DoorEntity
        {
            ExternalId         = Guid.NewGuid().ToString(),
            Name               = "Front Door",
            ReaderExternalId   = readerUid,
            ControllerId       = controller.Id,
            IsActive           = true,
            CreatedUtc         = DateTime.UtcNow,
            UpdatedUtc         = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var context = MakeContext(readerUid);

        // Act
        var result = await _sut.ResolveAsync(context, CancellationToken.None);

        // Assert
        Assert.True(result.IsFound);
        Assert.True(result.IsActive);
        Assert.True(result.ShouldForward);
        Assert.Equal(EquipmentKind.Door, result.EquipmentKind);
        Assert.Equal("Front Door", result.EquipmentName);
    }

    [Fact]
    public async Task Resolve_ReaderUidMatchesDoorReaderExternalId_InactiveDoor_ReturnsShouldForwardFalse()
    {
        // Arrange
        var readerUid = Guid.NewGuid().ToString();
        var controller = MakeController();
        _db.Controllers.Add(controller);
        await _db.SaveChangesAsync();

        _db.Doors.Add(new DoorEntity
        {
            ExternalId         = Guid.NewGuid().ToString(),
            Name               = "Decommissioned Door",
            ReaderExternalId   = readerUid,
            ControllerId       = controller.Id,
            IsActive           = false,
            CreatedUtc         = DateTime.UtcNow,
            UpdatedUtc         = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var context = MakeContext(readerUid);

        // Act
        var result = await _sut.ResolveAsync(context, CancellationToken.None);

        // Assert
        Assert.True(result.IsFound);
        Assert.False(result.IsActive);
        Assert.False(result.ShouldForward);
        Assert.Equal(EquipmentKind.Door, result.EquipmentKind);
    }

    // ── ResolveAsync via Door.ExternalId fallback ─────────────────────────────

    [Fact]
    public async Task Resolve_ReaderUidMatchesDoorExternalId_ActiveDoor_ReturnsShouldForwardTrue()
    {
        // Arrange: door has no ReaderExternalId, but ExternalId == readerUID from event
        var doorExternalId = Guid.NewGuid().ToString();
        var controller = MakeController();
        _db.Controllers.Add(controller);
        await _db.SaveChangesAsync();

        _db.Doors.Add(new DoorEntity
        {
            ExternalId         = doorExternalId,
            Name               = "Side Door",
            ReaderExternalId   = null,           // no reader external ID set
            ControllerId       = controller.Id,
            IsActive           = true,
            CreatedUtc         = DateTime.UtcNow,
            UpdatedUtc         = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var context = MakeContext(doorExternalId);

        // Act
        var result = await _sut.ResolveAsync(context, CancellationToken.None);

        // Assert
        Assert.True(result.IsFound);
        Assert.True(result.ShouldForward);
        Assert.Equal(EquipmentKind.Door, result.EquipmentKind);
    }

    [Fact]
    public async Task Resolve_ReaderUidMatchesDoorExternalId_InactiveDoor_ReturnsShouldForwardFalse()
    {
        // Arrange
        var doorExternalId = Guid.NewGuid().ToString();
        var controller = MakeController();
        _db.Controllers.Add(controller);
        await _db.SaveChangesAsync();

        _db.Doors.Add(new DoorEntity
        {
            ExternalId         = doorExternalId,
            Name               = "Old Door",
            ReaderExternalId   = null,
            ControllerId       = controller.Id,
            IsActive           = false,
            CreatedUtc         = DateTime.UtcNow,
            UpdatedUtc         = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        var context = MakeContext(doorExternalId);

        // Act
        var result = await _sut.ResolveAsync(context, CancellationToken.None);

        // Assert
        Assert.True(result.IsFound);
        Assert.False(result.ShouldForward);
    }

    // ── Not found ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Resolve_ReaderUidUnknown_ReturnsNotFoundAndNoForward()
    {
        // Arrange: database is empty
        var context = MakeContext(Guid.NewGuid().ToString());

        // Act
        var result = await _sut.ResolveAsync(context, CancellationToken.None);

        // Assert
        Assert.False(result.IsFound);
        Assert.False(result.IsActive);
        Assert.False(result.ShouldForward);
        Assert.Equal(EquipmentKind.Unknown, result.EquipmentKind);
    }

    [Fact]
    public async Task Resolve_NullReaderUid_ReturnsNotFound()
    {
        // Arrange: event has no readerUID
        var context = MakeContext(readerUid: null);

        // Act
        var result = await _sut.ResolveAsync(context, CancellationToken.None);

        // Assert
        Assert.False(result.IsFound);
        Assert.False(result.ShouldForward);
    }

    [Fact]
    public async Task Resolve_EmptyStringReaderUid_ReturnsNotFound()
    {
        // Arrange
        var context = MakeContext(readerUid: string.Empty);

        // Act
        var result = await _sut.ResolveAsync(context, CancellationToken.None);

        // Assert
        Assert.False(result.IsFound);
    }

    // ── ReaderExternalId takes priority over ExternalId fallback ──────────────

    [Fact]
    public async Task Resolve_ReaderExternalIdTakesPriorityOverExternalId()
    {
        // Arrange: two doors — one matched by ReaderExternalId, another by ExternalId.
        // The ReaderExternalId match should win.
        var readerUid  = Guid.NewGuid().ToString();
        var controller = MakeController();
        _db.Controllers.Add(controller);
        await _db.SaveChangesAsync();

        _db.Doors.AddRange(
            new DoorEntity
            {
                ExternalId       = readerUid,          // ExternalId == readerUid (fallback target)
                Name             = "Fallback Door",
                ControllerId     = controller.Id,
                IsActive         = false,              // inactive — should NOT win
                CreatedUtc       = DateTime.UtcNow,
                UpdatedUtc       = DateTime.UtcNow
            },
            new DoorEntity
            {
                ExternalId       = Guid.NewGuid().ToString(),
                Name             = "Primary Door",
                ReaderExternalId = readerUid,          // ReaderExternalId == readerUid (priority)
                ControllerId     = controller.Id,
                IsActive         = true,
                CreatedUtc       = DateTime.UtcNow,
                UpdatedUtc       = DateTime.UtcNow
            });
        await _db.SaveChangesAsync();

        var context = MakeContext(readerUid);

        // Act
        var result = await _sut.ResolveAsync(context, CancellationToken.None);

        // Assert: primary door via ReaderExternalId wins (active)
        Assert.True(result.ShouldForward);
        Assert.Equal("Primary Door", result.EquipmentName);
    }
}
