using Amadeus8.Configurations;
using Amadeus8.Data;
using Amadeus8.Entities;
using Amadeus8.Models;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Amadeus8.Tests;

public class DeviceImportServiceTests
{
    [Fact]
    public async Task ImportControllersAsync_SuccessfulImport_ReturnsDetailedSummary()
    {
        await using var db = CreateDbContext();
        var api = new FakeAmadeusApiClient
        {
            ControllerPages =
            [
                ([
                    new AmadeusController { Id = "ctrl-1", Name = "Controller 1", IsActive = true },
                    new AmadeusController { Id = "ctrl-2", Name = "Controller 2", IsActive = true }
                ], 2)
            ]
        };

        var sut = CreateSut(api, db);

        var result = await sut.ImportControllersAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(2, result.TotalReceived);
        Assert.Equal(2, result.Created);
        Assert.Equal(2, result.Succeeded);
        Assert.Equal(0, result.Failed);
        Assert.Equal(0, result.Skipped);
        Assert.Empty(result.Failures);

        Assert.Equal(2, await db.Controllers.CountAsync());
    }

    [Fact]
    public async Task ImportDoorsAsync_WhenOneRecordFails_ContinuesWithRemainingRecords()
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

        var api = new FakeAmadeusApiClient
        {
            ReaderPages =
            [
                ([
                    new AmadeusReader { Id = "reader-ok", Name = "Door OK", ControllerId = "ctrl-1" },
                    new AmadeusReader { Id = "reader-fail", Name = "Door Missing Controller", ControllerId = "ctrl-missing" }
                ], 2)
            ],
            InputPages = [([], 0)],
            OutputPages = [([], 0)]
        };

        var sut = CreateSut(api, db);

        var result = await sut.ImportDoorsAsync(CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(2, result.TotalReceived);
        Assert.Equal(1, result.Created);
        Assert.Equal(1, result.Succeeded);
        Assert.Equal(1, result.Failed);
        Assert.Contains(result.Failures, f => f.ExternalId == "reader-fail" && f.FailureCategory == "foreign-key-issue");

        Assert.Equal(1, await db.Doors.CountAsync());
    }

    [Fact]
    public async Task ImportControllersAsync_EmptySourceResponse_ReturnsZeroCounts()
    {
        await using var db = CreateDbContext();
        var api = new FakeAmadeusApiClient
        {
            ControllerPages = [([], 0)]
        };

        var sut = CreateSut(api, db);

        var result = await sut.ImportControllersAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(0, result.TotalReceived);
        Assert.Equal(0, result.Succeeded);
        Assert.Equal(0, result.Failed);
        Assert.Equal(0, result.Skipped);
        Assert.Empty(result.Failures);
    }

    [Fact]
    public async Task ImportControllersAsync_WhenRecordMissingExternalId_RecordsValidationFailureAndContinues()
    {
        await using var db = CreateDbContext();
        var api = new FakeAmadeusApiClient
        {
            ControllerPages =
            [
                ([
                    new AmadeusController { Id = "", Name = "Invalid Controller", IsActive = true },
                    new AmadeusController { Id = "ctrl-valid", Name = "Valid Controller", IsActive = true }
                ], 2)
            ]
        };

        var sut = CreateSut(api, db);

        var result = await sut.ImportControllersAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(2, result.TotalReceived);
        Assert.Equal(1, result.Created);
        Assert.Equal(1, result.Succeeded);
        Assert.Equal(1, result.Skipped);
        Assert.Equal(0, result.Failed);
        Assert.Contains(result.Failures, f => f.FailureStage == "validate" && f.FailureCategory == "missing-required-field");

        Assert.Equal(1, await db.Controllers.CountAsync());
    }

    [Fact]
    public async Task ImportControllersAsync_WhenSaveFailsForSingleRecord_ContinuesAndReportsDatabaseFailure()
    {
        await using var db = CreateFailingDbContext(failingExternalId: "ctrl-bad");
        var api = new FakeAmadeusApiClient
        {
            ControllerPages =
            [
                ([
                    new AmadeusController { Id = "ctrl-1", Name = "Controller 1", IsActive = true },
                    new AmadeusController { Id = "ctrl-bad", Name = "Controller Bad", IsActive = true },
                    new AmadeusController { Id = "ctrl-2", Name = "Controller 2", IsActive = true }
                ], 3)
            ]
        };

        var sut = CreateSut(api, db);

        var result = await sut.ImportControllersAsync(CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(3, result.TotalReceived);
        Assert.Equal(2, result.Created);
        Assert.Equal(2, result.Succeeded);
        Assert.Equal(1, result.Failed);
        Assert.Contains(result.Failures, f => f.ExternalId == "ctrl-bad" && f.FailureStage == "save");

        Assert.Equal(2, await db.Controllers.CountAsync());
        Assert.DoesNotContain(await db.Controllers.Select(c => c.ExternalId).ToListAsync(), x => x == "ctrl-bad");
    }

    [Fact]
    public async Task ImportControllersAsync_WhenControllerExists_UpdatesExistingRecord()
    {
        await using var db = CreateDbContext();
        db.Controllers.Add(new ControllerEntity
        {
            ExternalId = "ctrl-1",
            Name = "Old Name",
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var api = new FakeAmadeusApiClient
        {
            ControllerPages =
            [
                ([new AmadeusController { Id = "ctrl-1", Name = "New Name", IsActive = true }], 1)
            ]
        };

        var sut = CreateSut(api, db);

        var result = await sut.ImportControllersAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(1, result.TotalReceived);
        Assert.Equal(1, result.Updated);
        Assert.Equal(1, result.Succeeded);
        Assert.Equal(0, result.Failed);

        var updated = await db.Controllers.AsNoTracking().SingleAsync(x => x.ExternalId == "ctrl-1");
        Assert.Equal("New Name", updated.Name);
    }

    [Fact]
    public async Task ImportControllersAsync_DoesNotOverwriteIsActive()
    {
        await using var db = CreateDbContext();
        db.Controllers.Add(new ControllerEntity
        {
            ExternalId = "ctrl-1",
            Name = "Controller 1",
            IsActive = false,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var api = new FakeAmadeusApiClient
        {
            ControllerPages =
            [
                ([new AmadeusController { Id = "ctrl-1", Name = "Controller 1 Updated", IsActive = true }], 1)
            ]
        };

        var sut = CreateSut(api, db);

        await sut.ImportControllersAsync(CancellationToken.None);

        var entity = await db.Controllers.AsNoTracking().SingleAsync(x => x.ExternalId == "ctrl-1");
        Assert.False(entity.IsActive, "IsActive should not be overwritten during import");
        Assert.Equal("Controller 1 Updated", entity.Name);
    }

    private static DeviceImportService CreateSut(IAmadeusApiClient api, AmadeusDbContext db)
    {
        return new DeviceImportService(
            api,
            new FakeBackendEquipmentSnapshotProvider(),
            db,
            Options.Create(new AmadeusOptions { InfrastructureImportBatchSize = 100 }),
            NullLogger<DeviceImportService>.Instance);
    }

    private static AmadeusDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AmadeusDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AmadeusDbContext(options);
    }

    private static FailingAmadeusDbContext CreateFailingDbContext(string failingExternalId)
    {
        var options = new DbContextOptionsBuilder<AmadeusDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new FailingAmadeusDbContext(options, failingExternalId);
    }

    private sealed class FakeBackendEquipmentSnapshotProvider : IBackendEquipmentSnapshotProvider
    {
        private readonly BackendEquipmentSnapshot _snapshot = new()
        {
            LoadedUtc = DateTime.UtcNow
        };

        public Task EnsureLoadedAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        public Task RefreshAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        public BackendEquipmentSnapshot GetCurrent() => _snapshot;
    }

    private sealed class FailingAmadeusDbContext : AmadeusDbContext
    {
        private readonly string _failingExternalId;

        public FailingAmadeusDbContext(DbContextOptions<AmadeusDbContext> options, string failingExternalId)
            : base(options)
        {
            _failingExternalId = failingExternalId;
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var hasFailingController = ChangeTracker.Entries<ControllerEntity>()
                .Any(e => e.State == EntityState.Added && e.Entity.ExternalId == _failingExternalId);

            if (hasFailingController)
            {
                throw new DbUpdateException(
                    "Simulated UNIQUE KEY conflict while saving controller.",
                    new Exception("UNIQUE KEY constraint violation"));
            }

            return base.SaveChangesAsync(cancellationToken);
        }
    }

    private sealed class FakeAmadeusApiClient : IAmadeusApiClient
    {
        public List<(List<AmadeusController> Items, int? TotalCount)> ControllerPages { get; set; } = [];
        public List<(List<AmadeusReader> Items, int? TotalCount)> ReaderPages { get; set; } = [];
        public List<(List<AmadeusInput> Items, int? TotalCount)> InputPages { get; set; } = [];
        public List<(List<AmadeusOutput> Items, int? TotalCount)> OutputPages { get; set; } = [];

        private int _controllersPageIndex;
        private int _readersPageIndex;
        private int _inputsPageIndex;
        private int _outputsPageIndex;

        public Task<List<AmadeusController>> GetControllersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();

        public Task<(List<AmadeusController> Items, int? TotalCount)> GetControllersPagedAsync(int skip, int top, CancellationToken cancellationToken)
        {
            if (_controllersPageIndex >= ControllerPages.Count)
            {
                return Task.FromResult((new List<AmadeusController>(), (int?)ControllerPages.LastOrDefault().TotalCount));
            }

            return Task.FromResult(ControllerPages[_controllersPageIndex++]);
        }

        public Task<List<AmadeusReader>> GetReadersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();

        public Task<(List<AmadeusReader> Items, int? TotalCount)> GetReadersPagedAsync(int skip, int top, CancellationToken cancellationToken)
        {
            if (_readersPageIndex >= ReaderPages.Count)
            {
                return Task.FromResult((new List<AmadeusReader>(), (int?)ReaderPages.LastOrDefault().TotalCount));
            }

            return Task.FromResult(ReaderPages[_readersPageIndex++]);
        }

        public Task<List<AmadeusInput>> GetInputsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();

        public Task<(List<AmadeusInput> Items, int? TotalCount)> GetInputsPagedAsync(int skip, int top, CancellationToken cancellationToken)
        {
            if (_inputsPageIndex >= InputPages.Count)
            {
                return Task.FromResult((new List<AmadeusInput>(), (int?)InputPages.LastOrDefault().TotalCount));
            }

            return Task.FromResult(InputPages[_inputsPageIndex++]);
        }

        public Task<List<AmadeusOutput>> GetOutputsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();

        public Task<(List<AmadeusOutput> Items, int? TotalCount)> GetOutputsPagedAsync(int skip, int top, CancellationToken cancellationToken)
        {
            if (_outputsPageIndex >= OutputPages.Count)
            {
                return Task.FromResult((new List<AmadeusOutput>(), (int?)OutputPages.LastOrDefault().TotalCount));
            }

            return Task.FromResult(OutputPages[_outputsPageIndex++]);
        }

        public Task<List<AmadeusSecurityGroup>> GetSecurityGroupsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusSecurityGroup> Items, int? TotalCount)> GetSecurityGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusAccessGroup>> GetAccessGroupsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusAccessGroup> Items, int? TotalCount)> GetAccessGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusCardholder> Items, int? TotalCount)> GetCardholdersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholder?> GetCardholderByUidAsync(string uid, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholder> CreateCardholderAsync(object payload, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateCardholderAsync(string uid, object payload, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task DeleteCardholderAsync(string uid, CancellationToken cancellationToken) => throw new NotImplementedException();
    }
}
