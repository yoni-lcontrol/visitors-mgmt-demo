using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IBackendApiClient
{
    Task<SyncResultDto> TriggerFullSyncAsync(CancellationToken cancellationToken);

    Task<List<BackendControllerDto>> GetControllersAsync(CancellationToken cancellationToken);
    Task<List<BackendDoorDto>> GetDoorsAsync(CancellationToken cancellationToken);
    Task<List<BackendDoorIoDto>> GetDoorIosAsync(CancellationToken cancellationToken);
    Task<List<BackendExtensionDto>> GetExtensionsAsync(CancellationToken cancellationToken);
    Task<List<BackendExtensionIoDto>> GetExtensionIosAsync(CancellationToken cancellationToken);

    Task SendAmadeusEventsAsync(
        IReadOnlyCollection<BackendAmadeusEventDto> events,
        CancellationToken cancellationToken);
}