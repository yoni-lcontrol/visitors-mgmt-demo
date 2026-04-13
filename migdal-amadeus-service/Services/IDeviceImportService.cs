using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IDeviceImportService
{
    Task<SyncResultDto> ImportAllAsync(CancellationToken cancellationToken);
    Task<SyncResultDto> ImportControllersAsync(CancellationToken cancellationToken);
    Task<SyncResultDto> ImportDoorsAsync(CancellationToken cancellationToken);
    Task<SyncResultDto> ImportExtensionsAsync(CancellationToken cancellationToken);
}
