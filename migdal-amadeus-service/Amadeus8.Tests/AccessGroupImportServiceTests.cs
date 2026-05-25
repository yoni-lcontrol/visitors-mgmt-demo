using Amadeus8.Configurations;
using Amadeus8.Data;
using Amadeus8.Models;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Amadeus8.Tests;

public class AccessGroupImportServiceTests
{
    [Fact]
    public async Task ImportAccessGroupsAsync_TracksTotalAndSkippedForInvalidRecords()
    {
        await using var db = CreateDbContext();
        var api = new FakeAmadeusApiClient
        {
            AccessGroupPages =
            [
                ([
                    new AmadeusAccessGroup { Id = "ag-1", Name = "Access Group 1" },
                    new AmadeusAccessGroup { Id = "", Name = "Broken" }
                ], 2)
            ]
        };

        var sut = new AccessGroupImportService(
            api,
            db,
            Options.Create(new AmadeusOptions { AccessGroupsImportBatchSize = 100 }),
            NullLogger<AccessGroupImportService>.Instance);

        var result = await sut.ImportAccessGroupsAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(2, result.TotalReceived);
        Assert.Equal(1, result.Created);
        Assert.Equal(1, result.Skipped);
        Assert.Equal(0, result.Failed);

        var count = await db.AccessGroups.CountAsync();
        Assert.Equal(1, count);
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
        private int _pageIndex;

        public Task<(List<AmadeusAccessGroup> Items, int? TotalCount)> GetAccessGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken)
        {
            if (_pageIndex >= AccessGroupPages.Count)
            {
                return Task.FromResult((new List<AmadeusAccessGroup>(), (int?)AccessGroupPages.LastOrDefault().TotalCount));
            }

            return Task.FromResult(AccessGroupPages[_pageIndex++]);
        }

        public Task<List<AmadeusController>> GetControllersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusController> Items, int? TotalCount)> GetControllersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusReader>> GetReadersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusReader> Items, int? TotalCount)> GetReadersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusInput>> GetInputsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusInput> Items, int? TotalCount)> GetInputsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusOutput>> GetOutputsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusOutput> Items, int? TotalCount)> GetOutputsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusSecurityGroup>> GetSecurityGroupsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusSecurityGroup> Items, int? TotalCount)> GetSecurityGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusAccessGroup>> GetAccessGroupsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
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
