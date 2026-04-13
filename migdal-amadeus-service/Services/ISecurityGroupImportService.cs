using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface ISecurityGroupImportService
{
    Task<SyncResultDto> ImportSecurityGroupsAsync(CancellationToken cancellationToken);
}
