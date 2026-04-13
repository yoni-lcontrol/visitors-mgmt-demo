using Amadeus8.Configurations;
using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.Extensions.Options;

namespace Amadeus8.HostedServices;

public class AmadeusFullSyncHostedService : BackgroundService
{
    private readonly IBackendApiClient _backendApiClient;
    private readonly AmadeusOptions _options;
    private readonly ILogger<AmadeusFullSyncHostedService> _logger;

    private readonly SemaphoreSlim _syncLock = new(1, 1);
    private SyncStatusDto _status = new() { CurrentState = "NotStarted" };

    public AmadeusFullSyncHostedService(
        IBackendApiClient backendApiClient,
        IOptions<AmadeusOptions> options,
        ILogger<AmadeusFullSyncHostedService> logger)
    {
        _backendApiClient = backendApiClient;
        _options = options.Value;
        _logger = logger;
    }

    public SyncStatusDto GetStatus() => _status;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Amadeus full sync hosted service starting");

        if (_options.StartupSyncEnabled)
        {
            await RunSyncCycleAsync(stoppingToken);
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(
                    TimeSpan.FromMinutes(_options.FullSyncIntervalMinutes),
                    stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }

            await RunSyncCycleAsync(stoppingToken);
        }

        _logger.LogInformation("Amadeus full sync hosted service stopped");
    }

    private async Task RunSyncCycleAsync(CancellationToken stoppingToken)
    {
        if (!await _syncLock.WaitAsync(0, stoppingToken))
        {
            _logger.LogWarning("Sync cycle skipped because a previous cycle is still running");
            return;
        }

        try
        {
            _status = new SyncStatusDto
            {
                CurrentState = "Running",
                LastSyncStartUtc = DateTime.UtcNow
            };

            _logger.LogInformation("Starting backend full sync cycle");
            var result = await _backendApiClient.TriggerFullSyncAsync(stoppingToken);

            _status.LastSyncEndUtc = DateTime.UtcNow;
            _status.CurrentState = result.Success ? "CompletedSuccess" : "CompletedWithErrors";
            _status.LastErrorSummary = result.ErrorMessage;

            if (result.Success)
            {
                _status.LastSuccessfulSyncUtc = DateTime.UtcNow;
            }

            _logger.LogInformation(
                "Backend full sync cycle completed. Success: {Success}, Created: {Created}, Updated: {Updated}, Failed: {Failed}",
                result.Success, result.Created, result.Updated, result.Failed);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _status.CurrentState = "Cancelled";
            _logger.LogInformation("Sync cycle cancelled due to application shutdown");
        }
        catch (Exception ex)
        {
            _status.LastSyncEndUtc = DateTime.UtcNow;
            _status.CurrentState = "Failed";
            _status.LastErrorSummary = ex.Message;
            _logger.LogError(ex, "Backend full sync cycle failed");
        }
        finally
        {
            _syncLock.Release();
        }
    }
}
