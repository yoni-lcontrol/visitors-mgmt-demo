using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Models;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Services;

public class CardSyncService : ICardSyncService
{
    private const int PageSize = 50;

    private readonly IAmadeusApiClient _apiClient;
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<CardSyncService> _logger;

    public CardSyncService(
        IAmadeusApiClient apiClient,
        AmadeusDbContext dbContext,
        ILogger<CardSyncService> logger)
    {
        _apiClient = apiClient;
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<SyncResultDto> SyncAllCardsAsync(CancellationToken cancellationToken)
    {
        var result = new SyncResultDto { Operation = "SyncCards", StartedUtc = DateTime.UtcNow };

        try
        {
            _logger.LogInformation("Starting paged card sync");

            // Build cardholderUid → cardholderIdNumber lookup from local cardholders
            var cardholderLookup = await _dbContext.Cardholders
                .AsNoTracking()
                .Where(c => c.CardholderIdNumber != null)
                .ToDictionaryAsync(c => c.AmadeusUid, c => c.CardholderIdNumber!, cancellationToken);

            int skip = 0;
            int? totalCount = null;

            do
            {
                var (items, count) = await _apiClient.GetCardsPagedAsync(skip, PageSize, cancellationToken);
                totalCount ??= count;

                foreach (var ext in items)
                {
                    try
                    {
                        await UpsertCardAsync(ext, cardholderLookup, result, cancellationToken);
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        result.Failed++;
                        _logger.LogError(ex, "Failed to upsert card {Uid}", ext.Id);
                    }
                }

                await _dbContext.SaveChangesAsync(cancellationToken);
                skip += items.Count;

                _logger.LogInformation("Synced card page. Progress: {Skip}/{Total}", skip, totalCount);

            } while (skip < (totalCount ?? int.MaxValue) && !cancellationToken.IsCancellationRequested);

            result.Success = result.Failed == 0;
            result.CompletedUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "Card sync completed. Created: {Created}, Updated: {Updated}, Unchanged: {Unchanged}, Failed: {Failed}",
                result.Created, result.Updated, result.Unchanged, result.Failed);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.CompletedUtc = DateTime.UtcNow;
            result.ErrorMessage = ex.Message;
            _logger.LogError(ex, "Card sync failed");
        }

        return result;
    }

    private async Task UpsertCardAsync(
        AmadeusCard ext,
        Dictionary<string, string> cardholderLookup,
        SyncResultDto result,
        CancellationToken cancellationToken)
    {
        var existing = await _dbContext.Cards
            .FirstOrDefaultAsync(c => c.AmadeusUid == ext.Id, cancellationToken);

        // Resolve cardholderIdNumber from local cardholder lookup
        string? cardholderIdNumber = null;
        if (ext.CardholderUid is not null && cardholderLookup.TryGetValue(ext.CardholderUid, out var idNum))
        {
            cardholderIdNumber = idNum;
        }

        if (existing is null)
        {
            var entity = new CardEntity
            {
                AmadeusUid = ext.Id,
                CardholderUid = ext.CardholderUid,
                CardholderIdNumber = cardholderIdNumber,
                CardNumber = ext.CardNumber,
                Status = ext.Status,
                FromDateValidUtc = ext.FromDateValid?.ToUniversalTime(),
                ToDateValidUtc = ext.ToDateValid?.ToUniversalTime(),
                IsFromDateActive = ext.IsFromDateActive ?? false,
                IsToDateActive = ext.IsToDateActive ?? false,
                IsDeleted = false,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow,
            };
            _dbContext.Cards.Add(entity);
            result.Created++;
        }
        else
        {
            var changed = false;

            if (existing.CardholderUid != ext.CardholderUid) { existing.CardholderUid = ext.CardholderUid; changed = true; }
            if (existing.CardholderIdNumber != cardholderIdNumber) { existing.CardholderIdNumber = cardholderIdNumber; changed = true; }
            if (ext.CardNumber is not null && existing.CardNumber != ext.CardNumber) { existing.CardNumber = ext.CardNumber; changed = true; }
            if (existing.Status != ext.Status) { existing.Status = ext.Status; changed = true; }

            var fromDate = ext.FromDateValid?.ToUniversalTime();
            if (existing.FromDateValidUtc != fromDate) { existing.FromDateValidUtc = fromDate; changed = true; }

            var toDate = ext.ToDateValid?.ToUniversalTime();
            if (existing.ToDateValidUtc != toDate) { existing.ToDateValidUtc = toDate; changed = true; }

            if (existing.IsFromDateActive != (ext.IsFromDateActive ?? false)) { existing.IsFromDateActive = ext.IsFromDateActive ?? false; changed = true; }
            if (existing.IsToDateActive != (ext.IsToDateActive ?? false)) { existing.IsToDateActive = ext.IsToDateActive ?? false; changed = true; }

            if (changed)
            {
                existing.UpdatedUtc = DateTime.UtcNow;
                result.Updated++;
            }
            else
            {
                result.Unchanged++;
            }
        }
    }
}
