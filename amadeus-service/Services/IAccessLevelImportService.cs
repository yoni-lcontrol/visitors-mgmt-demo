using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IAccessLevelImportService
{
    Task<SyncResultDto> ImportAccessLevelsAsync(CancellationToken cancellationToken);
}
