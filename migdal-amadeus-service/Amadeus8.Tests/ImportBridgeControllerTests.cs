using Amadeus8.Controllers;
using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Amadeus8.Tests;

public class ImportBridgeControllerTests
{
    private readonly StubImportBridgeService _stubService = new();
    private readonly ImportJobManager _jobManager;
    private readonly IServiceScopeFactory _scopeFactory;

    public ImportBridgeControllerTests()
    {
        _jobManager = new ImportJobManager(NullLogger<ImportJobManager>.Instance);

        var services = new ServiceCollection();
        services.AddScoped<IImportBridgeService>(_ => _stubService);
        services.AddSingleton<IImportJobManager>(_jobManager);
        var sp = services.BuildServiceProvider();
        _scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
    }

    private ImportBridgeController CreateController()
    {
        return new ImportBridgeController(
            _jobManager,
            _scopeFactory,
            NullLogger<ImportBridgeController>.Instance);
    }

    private ImportBridgeController CreateControllerWithThrowingService()
    {
        var services = new ServiceCollection();
        services.AddScoped<IImportBridgeService>(_ => new ThrowingImportBridgeService());
        services.AddSingleton<IImportJobManager>(_jobManager);
        var sp = services.BuildServiceProvider();
        var scopeFactory = sp.GetRequiredService<IServiceScopeFactory>();

        return new ImportBridgeController(
            _jobManager,
            scopeFactory,
            NullLogger<ImportBridgeController>.Instance);
    }

    [Fact]
    public async Task ImportDevices_ReturnsAcceptedWithJobId()
    {
        var controller = CreateController();

        var result = controller.ImportDevices();

        var accepted = Assert.IsType<AcceptedResult>(result);
        Assert.NotNull(accepted.Value);

        var jobId = accepted.Value!.GetType().GetProperty("jobId")!.GetValue(accepted.Value) as string;
        Assert.False(string.IsNullOrEmpty(jobId));

        // Wait for background task to complete
        await Task.Delay(500);

        var job = _jobManager.GetJob(jobId!);
        Assert.NotNull(job);
        Assert.Equal("Completed", job!.Status);
        Assert.NotNull(job.Payload);
        Assert.Single(job.Payload!.Controllers);
        Assert.Equal("Stub Controller", job.Payload.Controllers[0].Name);
    }

    [Fact]
    public void GetImportStatus_ReturnsNotFoundForUnknownJob()
    {
        var controller = CreateController();

        var result = controller.GetImportStatus("nonexistent");

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task GetImportStatus_ReturnsCompletedJob()
    {
        var controller = CreateController();

        // Start a job
        var startResult = controller.ImportDevices();
        var accepted = Assert.IsType<AcceptedResult>(startResult);
        var jobId = accepted.Value!.GetType().GetProperty("jobId")!.GetValue(accepted.Value) as string;

        // Wait for background task
        await Task.Delay(500);

        var statusResult = controller.GetImportStatus(jobId!);
        var ok = Assert.IsType<OkObjectResult>(statusResult);
        Assert.NotNull(ok.Value);
    }

    [Fact]
    public async Task ImportDevices_WhenServiceThrows_JobStatusIsFailed()
    {
        var controller = CreateControllerWithThrowingService();

        var result = controller.ImportDevices();
        var accepted = Assert.IsType<AcceptedResult>(result);
        var jobId = accepted.Value!.GetType().GetProperty("jobId")!.GetValue(accepted.Value) as string;

        // Wait for background task
        await Task.Delay(500);

        var job = _jobManager.GetJob(jobId!);
        Assert.NotNull(job);
        Assert.Equal("Failed", job!.Status);
        Assert.Contains("simulated failure", job.ErrorMessage);
    }

    [Fact]
    public async Task ImportAccessLevels_ReturnsOkWithAccessLevels()
    {
        var controller = CreateController();

        var result = await controller.ImportAccessLevels(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<AccessLevelCallbackPayload>(ok.Value);
        Assert.Single(payload.AccessLevels);
        Assert.Equal("Stub Level", payload.AccessLevels[0].Name);
    }

    [Fact]
    public async Task ImportAccessLevels_WhenServiceThrows_ReturnsOkWithEmptyPayload()
    {
        var controller = CreateControllerWithThrowingService();

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
