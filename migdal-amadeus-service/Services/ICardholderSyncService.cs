using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface ICardholderSyncService
{
    Task<SyncResultDto> SyncAllCardholdersAsync(CancellationToken cancellationToken);
}
