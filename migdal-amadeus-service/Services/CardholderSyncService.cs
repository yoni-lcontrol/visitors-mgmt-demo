using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Models;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Services;

public class CardholderSyncService : ICardholderSyncService
{
    private const int PageSize = 50;

    private readonly IAmadeusApiClient _apiClient;
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<CardholderSyncService> _logger;

    public CardholderSyncService(
        IAmadeusApiClient apiClient,
        AmadeusDbContext dbContext,
        ILogger<CardholderSyncService> logger)
    {
        _apiClient = apiClient;
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<SyncResultDto> SyncAllCardholdersAsync(CancellationToken cancellationToken)
    {
        var result = new SyncResultDto { Operation = "SyncCardholders", StartedUtc = DateTime.UtcNow };

        try
        {
            _logger.LogInformation("Starting paged cardholder sync");

            int skip = 0;
            int? totalCount = null;

            do
            {
                var (items, count) = await _apiClient.GetCardholdersPagedAsync(skip, PageSize, cancellationToken);
                totalCount ??= count;

                foreach (var ext in items)
                {
                    try
                    {
                        await UpsertCardholderAsync(ext, result, cancellationToken);
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        result.Failed++;
                        _logger.LogError(ex, "Failed to upsert cardholder {Uid}", ext.Id);
                    }
                }

                await _dbContext.SaveChangesAsync(cancellationToken);
                skip += items.Count;

                _logger.LogInformation("Synced cardholder page. Progress: {Skip}/{Total}", skip, totalCount);

            } while (skip < (totalCount ?? int.MaxValue) && !cancellationToken.IsCancellationRequested);

            result.Success = result.Failed == 0;
            result.CompletedUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "Cardholder sync completed. Created: {Created}, Updated: {Updated}, Unchanged: {Unchanged}, Failed: {Failed}",
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
            _logger.LogError(ex, "Cardholder sync failed");
        }

        return result;
    }

    private async Task UpsertCardholderAsync(AmadeusCardholder ext, SyncResultDto result, CancellationToken cancellationToken)
    {
        var existing = await _dbContext.Cardholders
            .FirstOrDefaultAsync(c => c.AmadeusUid == ext.Id, cancellationToken);

        if (existing is null)
        {
            var entity = new CardholderEntity
            {
                AmadeusUid = ext.Id,
                CardholderIdNumber = ext.CardholderIdNumber,
                FirstName = ext.FirstName,
                LastName = ext.LastName,
                Description = ext.Description,
                CardholderTypeUid = ext.CardholderTypeId,
                DepartmentUid = ext.DepartmentId,
                Status = ext.Status,
                FromDateValidUtc = ext.FromDateValid?.ToUniversalTime(),
                ToDateValidUtc = ext.ToDateValid?.ToUniversalTime(),
                IsFromDateActive = ext.IsFromDateActive ?? false,
                IsToDateActive = ext.IsToDateActive ?? false,
                SecurityGroupUid = ext.SecurityGroupId,
                SecurityGroupApiKey = ext.SecurityGroupApiKey,
                AccessGroupUidsRaw = ext.AccessGroupIds,
                AccessGroupApiKeysRaw = ext.AccessGroupApiKeys,
                LastDownloadTimeUtc = ext.LastDownloadTime?.ToUniversalTime(),
                IsDeleted = false,
                IsArchived = false,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };
            _dbContext.Cardholders.Add(entity);
            result.Created++;
        }
        else
        {
            var changed = false;

            if (existing.CardholderIdNumber != ext.CardholderIdNumber) { existing.CardholderIdNumber = ext.CardholderIdNumber; changed = true; }
            if (existing.FirstName != ext.FirstName) { existing.FirstName = ext.FirstName; changed = true; }
            if (existing.LastName != ext.LastName) { existing.LastName = ext.LastName; changed = true; }
            if (existing.Description != ext.Description) { existing.Description = ext.Description; changed = true; }
            if (existing.CardholderTypeUid != ext.CardholderTypeId) { existing.CardholderTypeUid = ext.CardholderTypeId; changed = true; }
            if (existing.DepartmentUid != ext.DepartmentId) { existing.DepartmentUid = ext.DepartmentId; changed = true; }
            if (existing.Status != ext.Status) { existing.Status = ext.Status; changed = true; }
            if (existing.SecurityGroupUid != ext.SecurityGroupId) { existing.SecurityGroupUid = ext.SecurityGroupId; changed = true; }
            if (existing.SecurityGroupApiKey != ext.SecurityGroupApiKey) { existing.SecurityGroupApiKey = ext.SecurityGroupApiKey; changed = true; }
            if (existing.AccessGroupUidsRaw != ext.AccessGroupIds) { existing.AccessGroupUidsRaw = ext.AccessGroupIds; changed = true; }
            if (existing.AccessGroupApiKeysRaw != ext.AccessGroupApiKeys) { existing.AccessGroupApiKeysRaw = ext.AccessGroupApiKeys; changed = true; }

            var fromDate = ext.FromDateValid?.ToUniversalTime();
            if (existing.FromDateValidUtc != fromDate) { existing.FromDateValidUtc = fromDate; changed = true; }

            var toDate = ext.ToDateValid?.ToUniversalTime();
            if (existing.ToDateValidUtc != toDate) { existing.ToDateValidUtc = toDate; changed = true; }

            if (existing.IsFromDateActive != (ext.IsFromDateActive ?? false)) { existing.IsFromDateActive = ext.IsFromDateActive ?? false; changed = true; }
            if (existing.IsToDateActive != (ext.IsToDateActive ?? false)) { existing.IsToDateActive = ext.IsToDateActive ?? false; changed = true; }

            var lastDownload = ext.LastDownloadTime?.ToUniversalTime();
            if (existing.LastDownloadTimeUtc != lastDownload) { existing.LastDownloadTimeUtc = lastDownload; changed = true; }

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
