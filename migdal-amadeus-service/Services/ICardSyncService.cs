using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface ICardSyncService
{
    Task<SyncResultDto> SyncAllCardsAsync(CancellationToken cancellationToken);
}
