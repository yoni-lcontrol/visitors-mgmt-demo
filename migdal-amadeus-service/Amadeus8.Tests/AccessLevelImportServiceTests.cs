using Amadeus8.Configurations;
using Amadeus8.Data;
using Amadeus8.Entities;
using Amadeus8.Models;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Amadeus8.Tests;

public class AccessLevelImportServiceTests
{
    [Fact]
    public async Task ImportAccessLevelsAsync_CreatesRowsFromAccessAndSecurityGroups()
    {
        await using var db = CreateDbContext();
        var api = new FakeAmadeusApiClient
        {
            AccessGroupPages =
            [
                ([new AmadeusAccessGroup { Id = "ag-1", Name = "Access Group 1", ApiKey = "ag-key-1", ExternalId = "ext-ag-1" }], 1)
            ],
            SecurityGroupPages =
            [
                ([new AmadeusSecurityGroup { Id = "sg-1", Name = "Security Group 1", ApiKey = "sg-key-1", ExternalId = "ext-sg-1" }], 1)
            ]
        };

        var sut = CreateSut(api, db, batchSize: 100);

        var result = await sut.ImportAccessLevelsAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(2, result.TotalReceived);
        Assert.Equal(2, result.Created);
        Assert.Equal(0, result.Updated);
        Assert.Equal(0, result.Skipped);
        Assert.Equal(0, result.Failed);

        var rows = await db.AccessLevels.AsNoTracking().OrderBy(x => x.SourceType).ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.Contains(rows, x => x.SourceType == "AccessGroup" && x.AmadeusUid == "ag-1" && x.ExternalId == "ag-1");
        Assert.Contains(rows, x => x.SourceType == "SecurityGroup" && x.AmadeusUid == "sg-1" && x.ExternalId == "sg-1");
    }

    [Fact]
    public async Task ImportAccessLevelsAsync_UpdatesExistingAndSkipsInvalid()
    {
        await using var db = CreateDbContext();
        db.AccessLevels.Add(new AccessLevelEntity
        {
            SourceType = "AccessGroup",
            AmadeusUid = "ag-1",
            Name = "Old Name",
            ApiKey = "old-key",
            ExternalId = "old-ext",
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var api = new FakeAmadeusApiClient
        {
            AccessGroupPages =
            [
                ([
                    new AmadeusAccessGroup { Id = "ag-1", Name = "New Name", ApiKey = "new-key", ExternalId = "new-ext" },
                    new AmadeusAccessGroup { Id = "", Name = "Broken" }
                ], 2)
            ],
            SecurityGroupPages =
            [
                ([new AmadeusSecurityGroup { Id = "sg-2", Name = "Security Group 2" }], 1)
            ]
        };

        var sut = CreateSut(api, db, batchSize: 100);

        var result = await sut.ImportAccessLevelsAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(3, result.TotalReceived);
        Assert.Equal(1, result.Created);
        Assert.Equal(1, result.Updated);
        Assert.Equal(1, result.Skipped);
        Assert.Equal(0, result.Failed);

        var updated = await db.AccessLevels.AsNoTracking().SingleAsync(x => x.SourceType == "AccessGroup" && x.AmadeusUid == "ag-1");
        Assert.Equal("New Name", updated.Name);
        Assert.Equal("new-key", updated.ApiKey);
        Assert.Equal("ag-1", updated.ExternalId);
    }

    [Fact]
    public async Task ImportAccessLevelsAsync_DoesNotOverwriteIsActive()
    {
        await using var db = CreateDbContext();
        db.AccessLevels.Add(new AccessLevelEntity
        {
            SourceType = "AccessGroup",
            AmadeusUid = "ag-1",
            Name = "Level 1",
            ApiKey = "key-1",
            IsActive = false,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var api = new FakeAmadeusApiClient
        {
            AccessGroupPages =
            [
                ([new AmadeusAccessGroup { Id = "ag-1", Name = "Level 1 Updated", ApiKey = "key-1" }], 1)
            ],
            SecurityGroupPages = []
        };

        var sut = CreateSut(api, db, batchSize: 100);

        await sut.ImportAccessLevelsAsync(CancellationToken.None);

        var entity = await db.AccessLevels.AsNoTracking().SingleAsync(x => x.AmadeusUid == "ag-1");
        Assert.False(entity.IsActive, "IsActive should not be overwritten during import");
    }

    private static AccessLevelImportService CreateSut(FakeAmadeusApiClient api, AmadeusDbContext db, int batchSize)
    {
        var options = Options.Create(new AmadeusOptions
        {
            AccessGroupsImportBatchSize = batchSize
        });

        return new AccessLevelImportService(
            api,
            db,
            options,
            NullLogger<AccessLevelImportService>.Instance);
    }

    private static AmadeusDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AmadeusDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AmadeusDbContext(options);
    }

    private sealed class FakeAmadeusApiClient : IAmadeusApiClient
    {
        public List<(List<AmadeusAccessGroup> Items, int? TotalCount)> AccessGroupPages { get; set; } = [];
        public List<(List<AmadeusSecurityGroup> Items, int? TotalCount)> SecurityGroupPages { get; set; } = [];

        private int _accessGroupPageIndex;
        private int _securityGroupPageIndex;

        public Task<List<AmadeusController>> GetControllersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusController> Items, int? TotalCount)> GetControllersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusReader>> GetReadersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusReader> Items, int? TotalCount)> GetReadersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusInput>> GetInputsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusInput> Items, int? TotalCount)> GetInputsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusOutput>> GetOutputsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusOutput> Items, int? TotalCount)> GetOutputsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();

        public Task<List<AmadeusSecurityGroup>> GetSecurityGroupsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();

        public Task<(List<AmadeusSecurityGroup> Items, int? TotalCount)> GetSecurityGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken)
        {
            if (_securityGroupPageIndex >= SecurityGroupPages.Count)
            {
                return Task.FromResult((new List<AmadeusSecurityGroup>(), (int?)SecurityGroupPages.LastOrDefault().TotalCount));
            }

            var page = SecurityGroupPages[_securityGroupPageIndex++];
            return Task.FromResult(page);
        }

        public Task<List<AmadeusAccessGroup>> GetAccessGroupsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();

        public Task<(List<AmadeusAccessGroup> Items, int? TotalCount)> GetAccessGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken)
        {
            if (_accessGroupPageIndex >= AccessGroupPages.Count)
            {
                return Task.FromResult((new List<AmadeusAccessGroup>(), (int?)AccessGroupPages.LastOrDefault().TotalCount));
            }

            var page = AccessGroupPages[_accessGroupPageIndex++];
            return Task.FromResult(page);
        }

        public Task<(List<AmadeusCardholder> Items, int? TotalCount)> GetCardholdersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholder?> GetCardholderByUidAsync(string uid, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholder?> GetCardholderByIdNumberAsync(string cardholderIdNumber, CancellationToken cancellationToken) => Task.FromResult<AmadeusCardholder?>(null);
        public Task<AmadeusCardholder> CreateCardholderAsync(object payload, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task UpdateCardholderAsync(string uid, object payload, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task DeleteCardholderAsync(string uid, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholderPersonalDetails?> GetCardholderPersonalDetailsAsync(string cardholderUid, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholderPersonalDetails> UpsertLicensePlateAsync(string cardholderUid, string licensePlate, CancellationToken cancellationToken) => throw new NotImplementedException();
    }
}
