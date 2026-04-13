using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace Amadeus8.Tests;

public class AccessImportRoutingServiceTests
{
    [Fact]
    public async Task ImportAsync_AccessLevels_RoutesToAccessLevelService()
    {
        var accessGroups = new SpyAccessGroupImportService();
        var accessLevels = new SpyAccessLevelImportService();

        var sut = new AccessImportRoutingService(
            accessGroups,
            accessLevels,
            NullLogger<AccessImportRoutingService>.Instance);

        var result = await sut.ImportAsync(AccessImportType.AccessLevels, CancellationToken.None);

        Assert.True(accessLevels.WasCalled);
        Assert.False(accessGroups.WasCalled);
        Assert.Equal("ImportAccessLevels", result.Operation);
    }

    [Fact]
    public async Task ImportAsync_AccessGroups_RoutesToAccessGroupService()
    {
        var accessGroups = new SpyAccessGroupImportService();
        var accessLevels = new SpyAccessLevelImportService();

        var sut = new AccessImportRoutingService(
            accessGroups,
            accessLevels,
            NullLogger<AccessImportRoutingService>.Instance);

        var result = await sut.ImportAsync(AccessImportType.AccessGroups, CancellationToken.None);

        Assert.True(accessGroups.WasCalled);
        Assert.False(accessLevels.WasCalled);
        Assert.Equal("ImportAccessGroups", result.Operation);
    }

    private sealed class SpyAccessGroupImportService : IAccessGroupImportService
    {
        public bool WasCalled { get; private set; }

        public Task<SyncResultDto> ImportAccessGroupsAsync(CancellationToken cancellationToken)
        {
            WasCalled = true;
            return Task.FromResult(new SyncResultDto { Success = true, Operation = "ImportAccessGroups" });
        }
    }

    private sealed class SpyAccessLevelImportService : IAccessLevelImportService
    {
        public bool WasCalled { get; private set; }

        public Task<SyncResultDto> ImportAccessLevelsAsync(CancellationToken cancellationToken)
        {
            WasCalled = true;
            return Task.FromResult(new SyncResultDto { Success = true, Operation = "ImportAccessLevels" });
        }
    }
}
