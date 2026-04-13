using Amadeus8.Controllers;
using Amadeus8.Configurations;
using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Amadeus8.Tests;

public class AmadeusImportControllerTests
{
    [Fact]
    public async Task ImportAccess_ImportTypeAccessLevels_ReturnsOkWithSummary()
    {
        var routingService = new StubRoutingService(new SyncResultDto
        {
            Success = true,
            Operation = "ImportAccessLevels",
            TotalReceived = 10,
            Created = 3,
            Updated = 5,
            Skipped = 1,
            Failed = 1,
            StartedUtc = DateTime.UtcNow,
            CompletedUtc = DateTime.UtcNow
        });

        var controller = new AmadeusImportController(
            routingService,
            Options.Create(new AmadeusImportSettings { ImportAccessLevels = true }),
            NullLogger<AmadeusImportController>.Instance);

        var action = await controller.ImportAccess(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(action);
        var response = Assert.IsType<ImportSummaryResponseDto>(ok.Value);

        Assert.True(response.Success);
        Assert.Equal("AccessLevels", response.ImportType);
        Assert.Equal(10, response.TotalReceived);
        Assert.Equal(3, response.Created);
        Assert.Equal(5, response.Updated);
        Assert.Equal(1, response.Skipped);
        Assert.Equal(1, response.Failed);
        Assert.Equal("ImportAccessLevels", response.Operation);
        Assert.Equal(AccessImportType.AccessLevels, routingService.LastType);
    }

    [Fact]
    public async Task ImportAccess_ImportTypeAccessGroups_ReturnsOkWithSummary()
    {
        var routingService = new StubRoutingService(new SyncResultDto
        {
            Success = true,
            Operation = "ImportAccessGroups"
        });

        var controller = new AmadeusImportController(
            routingService,
            Options.Create(new AmadeusImportSettings { ImportAccessLevels = false }),
            NullLogger<AmadeusImportController>.Instance);

        var action = await controller.ImportAccess(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(action);
        var response = Assert.IsType<ImportSummaryResponseDto>(ok.Value);

        Assert.True(response.Success);
        Assert.Equal("AccessGroups", response.ImportType);
        Assert.Equal(AccessImportType.AccessGroups, routingService.LastType);
    }

    [Fact]
    public async Task ImportAccess_MissingImportType_ReturnsBadRequest()
    {
        var routingService = new StubRoutingService(new SyncResultDto { Success = true });

        var controller = new AmadeusImportController(
            routingService,
            Options.Create(new AmadeusImportSettings { ImportAccessLevels = null }),
            NullLogger<AmadeusImportController>.Instance);

        var action = await controller.ImportAccess(CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(action);
        var response = Assert.IsType<ImportSummaryResponseDto>(badRequest.Value);

        Assert.False(response.Success);
        Assert.Contains("missing", response.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ImportAccess_WhenServiceFails_Returns500()
    {
        var routingService = new StubRoutingService(new SyncResultDto
        {
            Success = false,
            Operation = "ImportAccessLevels",
            ErrorMessage = "fatal error"
        });

        var controller = new AmadeusImportController(
            routingService,
            Options.Create(new AmadeusImportSettings { ImportAccessLevels = true }),
            NullLogger<AmadeusImportController>.Instance);

        var action = await controller.ImportAccess(CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(action);
        Assert.Equal(500, objectResult.StatusCode);

        var response = Assert.IsType<ImportSummaryResponseDto>(objectResult.Value);
        Assert.False(response.Success);
        Assert.Contains("failed", response.Message, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class StubRoutingService : IAccessImportRoutingService
    {
        private readonly SyncResultDto _result;
        public AccessImportType? LastType { get; private set; }

        public StubRoutingService(SyncResultDto result)
        {
            _result = result;
        }

        public Task<SyncResultDto> ImportAsync(AccessImportType importType, CancellationToken cancellationToken)
        {
            LastType = importType;
            return Task.FromResult(_result);
        }
    }
}
