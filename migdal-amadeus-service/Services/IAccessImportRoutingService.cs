using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IAccessImportRoutingService
{
    Task<SyncResultDto> ImportAsync(AccessImportType importType, CancellationToken cancellationToken);
}
