using Amadeus8.DTOs;

namespace Amadeus8.Services;

public class BackendEquipmentSnapshotProvider : IBackendEquipmentSnapshotProvider
{
    private readonly IBackendApiClient _backendApiClient;
    private readonly ILogger<BackendEquipmentSnapshotProvider> _logger;
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    private BackendEquipmentSnapshot _current = new()
    {
        LoadedUtc = DateTime.MinValue
    };

    public BackendEquipmentSnapshotProvider(
        IBackendApiClient backendApiClient,
        ILogger<BackendEquipmentSnapshotProvider> logger)
    {
        _backendApiClient = backendApiClient;
        _logger = logger;
    }

    public async Task EnsureLoadedAsync(CancellationToken cancellationToken)
    {
        if (_current.LoadedUtc != DateTime.MinValue)
        {
            return;
        }

        await RefreshAsync(cancellationToken);
    }

    public async Task RefreshAsync(CancellationToken cancellationToken)
    {
        await _refreshLock.WaitAsync(cancellationToken);
        try
        {
            _logger.LogInformation("Startup central equipment load started via backend APIs");

            var controllers = await _backendApiClient.GetControllersAsync(cancellationToken);
            var doors = await _backendApiClient.GetDoorsAsync(cancellationToken);
            var doorIos = await _backendApiClient.GetDoorIosAsync(cancellationToken);
            var extensions = await _backendApiClient.GetExtensionsAsync(cancellationToken);
            var extensionIos = await _backendApiClient.GetExtensionIosAsync(cancellationToken);

            _current = new BackendEquipmentSnapshot
            {
                LoadedUtc = DateTime.UtcNow,
                ControllersByExternalId = IndexByExternalId(controllers),
                DoorsByExternalId = IndexByExternalId(doors),
                DoorIosByExternalId = IndexByExternalId(doorIos),
                ExtensionsByExternalId = IndexByExternalId(extensions),
                ExtensionIosByExternalId = IndexByExternalId(extensionIos)
            };

            _logger.LogInformation(
                "Startup central equipment load completed. Controllers: {Controllers}, Doors: {Doors}, DoorIos: {DoorIos}, Extensions: {Extensions}, ExtensionIos: {ExtensionIos}",
                _current.ControllersByExternalId.Count,
                _current.DoorsByExternalId.Count,
                _current.DoorIosByExternalId.Count,
                _current.ExtensionsByExternalId.Count,
                _current.ExtensionIosByExternalId.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Startup central equipment load failed");
            throw;
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    public BackendEquipmentSnapshot GetCurrent()
    {
        return _current;
    }

    private static Dictionary<string, T> IndexByExternalId<T>(IEnumerable<T> items)
    {
        var map = new Dictionary<string, T>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in items)
        {
            var id = ResolveExternalId(item);
            if (string.IsNullOrWhiteSpace(id))
            {
                continue;
            }

            map[id] = item;
        }

        return map;
    }

    private static string? ResolveExternalId<T>(T item)
    {
        return item switch
        {
            BackendControllerDto dto => dto.ExternalId ?? dto.AmadeusUid ?? dto.Id,
            BackendDoorDto dto => dto.ExternalId ?? dto.AmadeusUid ?? dto.Id,
            BackendDoorIoDto dto => dto.ExternalId ?? dto.AmadeusUid ?? dto.Id,
            BackendExtensionDto dto => dto.ExternalId ?? dto.AmadeusUid ?? dto.Id,
            BackendExtensionIoDto dto => dto.ExternalId ?? dto.AmadeusUid ?? dto.Id,
            _ => null
        };
    }
}