using Amadeus8.Controllers;
using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace Amadeus8.Tests;

public class ImportBridgeControllerTests
{
    private readonly StubImportBridgeService _stubService = new();
    private readonly ImportBridgeController _controller;

    public ImportBridgeControllerTests()
    {
        _controller = new ImportBridgeController(
            _stubService,
            NullLogger<ImportBridgeController>.Instance);
    }

    [Fact]
    public async Task ImportDevices_ReturnsOkWithControllers()
    {
        var result = await _controller.ImportDevices(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<ImportCallbackPayload>(ok.Value);
        Assert.Single(payload.Controllers);
        Assert.Equal("Stub Controller", payload.Controllers[0].Name);
        Assert.True(payload.Controllers[0].Active);
    }

    [Fact]
    public async Task ImportAccessLevels_ReturnsOkWithAccessLevels()
    {
        var result = await _controller.ImportAccessLevels(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<AccessLevelCallbackPayload>(ok.Value);
        Assert.Single(payload.AccessLevels);
        Assert.Equal("Stub Level", payload.AccessLevels[0].Name);
    }

    [Fact]
    public async Task ImportDevices_WhenServiceThrows_ReturnsOkWithEmptyPayload()
    {
        var controller = new ImportBridgeController(
            new ThrowingImportBridgeService(),
            NullLogger<ImportBridgeController>.Instance);

        var result = await controller.ImportDevices(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<ImportCallbackPayload>(ok.Value);
        Assert.Empty(payload.Controllers);
    }

    [Fact]
    public async Task ImportAccessLevels_WhenServiceThrows_ReturnsOkWithEmptyPayload()
    {
        var controller = new ImportBridgeController(
            new ThrowingImportBridgeService(),
            NullLogger<ImportBridgeController>.Instance);

        var result = await controller.ImportAccessLevels(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<AccessLevelCallbackPayload>(ok.Value);
        Assert.Empty(payload.AccessLevels);
    }

    private class StubImportBridgeService : IImportBridgeService
    {
        public Task<ImportCallbackPayload> ImportDevicesAsync(CancellationToken cancellationToken)
            => Task.FromResult(new ImportCallbackPayload
            {
                Controllers = [new CallbackController { Name = "Stub Controller", ExternalId = "c1", Active = true }]
            });

        public Task<AccessLevelCallbackPayload> ImportAccessLevelsAsync(CancellationToken cancellationToken)
            => Task.FromResult(new AccessLevelCallbackPayload
            {
                AccessLevels = [new CallbackAccessLevel { Name = "Stub Level", Active = true }]
            });
    }

    private class ThrowingImportBridgeService : IImportBridgeService
    {
        public Task<ImportCallbackPayload> ImportDevicesAsync(CancellationToken cancellationToken)
            => throw new InvalidOperationException("simulated failure");

        public Task<AccessLevelCallbackPayload> ImportAccessLevelsAsync(CancellationToken cancellationToken)
            => throw new InvalidOperationException("simulated failure");
    }
}
