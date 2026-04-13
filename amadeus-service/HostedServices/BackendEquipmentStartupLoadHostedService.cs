using Amadeus8.Services;

namespace Amadeus8.HostedServices;

public class BackendEquipmentStartupLoadHostedService : IHostedService
{
    private readonly IBackendEquipmentSnapshotProvider _snapshotProvider;
    private readonly ILogger<BackendEquipmentStartupLoadHostedService> _logger;

    public BackendEquipmentStartupLoadHostedService(
        IBackendEquipmentSnapshotProvider snapshotProvider,
        ILogger<BackendEquipmentStartupLoadHostedService> logger)
    {
        _snapshotProvider = snapshotProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _snapshotProvider.RefreshAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Backend equipment startup load failed; service will continue and retry on-demand during imports");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}