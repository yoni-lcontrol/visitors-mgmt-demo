using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IAccessGroupImportService
{
    Task<SyncResultDto> ImportAccessGroupsAsync(CancellationToken cancellationToken);
}
