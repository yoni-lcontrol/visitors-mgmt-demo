using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Configurations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class AccessGroupImportService : IAccessGroupImportService
{
    private const int AmadeusTopLimit = 50;

    private readonly IAmadeusApiClient _apiClient;
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<AccessGroupImportService> _logger;
    private readonly int _batchSize;

    public AccessGroupImportService(
        IAmadeusApiClient apiClient,
        AmadeusDbContext dbContext,
        IOptions<AmadeusOptions> options,
        ILogger<AccessGroupImportService> logger)
    {
        _apiClient = apiClient;
        _dbContext = dbContext;
        _batchSize = Math.Min(options.Value.AccessGroupsImportBatchSize, AmadeusTopLimit);
        _logger = logger;
    }

    public async Task<SyncResultDto> ImportAccessGroupsAsync(CancellationToken cancellationToken)
    {
        var result = new SyncResultDto { Operation = "ImportAccessGroups", StartedUtc = DateTime.UtcNow };

        try
        {
            _logger.LogInformation("Importing access groups from Amadeus");
            var skip = 0;
            var batchIndex = 0;
            var processed = 0;
            int? totalCount = null;

            while (!cancellationToken.IsCancellationRequested)
            {
                batchIndex++;
                _logger.LogInformation("Access group batch {Batch} started. Skip={Skip}, Top={Top}", batchIndex, skip, _batchSize);

                var (externalGroups, count) = await _apiClient.GetAccessGroupsPagedAsync(skip, _batchSize, cancellationToken);
                totalCount ??= count;

                if (externalGroups.Count == 0)
                {
                    _logger.LogInformation("Access group batch {Batch} returned no records; stopping paging loop", batchIndex);
                    break;
                }

                result.TotalReceived += externalGroups.Count;

                foreach (var ext in externalGroups)
                {
                    try
                    {
                        if (string.IsNullOrWhiteSpace(ext.Id))
                        {
                            result.Skipped++;
                            _logger.LogWarning("Skipping access group record with missing uid");
                            continue;
                        }

                        var existing = await _dbContext.AccessGroups
                            .FirstOrDefaultAsync(g => g.AmadeusUid == ext.Id, cancellationToken);

                        if (existing is null)
                        {
                            _logger.LogDebug("Creating access group with UID {Uid}", ext.Id);
                            var entity = new AccessGroupEntity
                            {
                                AmadeusUid = ext.Id,
                                ApiKey = ext.ApiKey,
                                Name = ext.Name ?? ext.Id,
                                Description = ext.Description,
                                IsActive = true,
                                CreatedUtc = DateTime.UtcNow,
                                UpdatedUtc = DateTime.UtcNow
                            };
                            _dbContext.AccessGroups.Add(entity);
                            result.Created++;
                        }
                        else
                        {
                            var changed = false;

                            if (existing.Name != (ext.Name ?? ext.Id)) { existing.Name = ext.Name ?? ext.Id; changed = true; }
                            if (existing.ApiKey != ext.ApiKey) { existing.ApiKey = ext.ApiKey; changed = true; }
                            if (existing.Description != ext.Description) { existing.Description = ext.Description; changed = true; }

                            if (changed)
                            {
                                _logger.LogDebug("Updating access group with UID {Uid}", ext.Id);
                                existing.UpdatedUtc = DateTime.UtcNow;
                                result.Updated++;
                            }
                            else
                            {
                                result.Unchanged++;
                            }
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        result.Failed++;
                        _logger.LogError(ex, "Failed to upsert access group {Uid}", ext.Id);
                    }
                }

                await _dbContext.SaveChangesAsync(cancellationToken);
                _dbContext.ChangeTracker.Clear();

                processed += externalGroups.Count;
                skip += externalGroups.Count;

                _logger.LogInformation(
                    "Access group batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                    batchIndex,
                    externalGroups.Count,
                    processed,
                    totalCount);

                if (externalGroups.Count < _batchSize)
                {
                    break;
                }
            }

            // Per-record failures are counted but do not fail the whole import run.
            result.Success = true;
            result.CompletedUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "Access group import completed. TotalReceived: {TotalReceived}, Created: {Created}, Updated: {Updated}, Unchanged: {Unchanged}, Skipped: {Skipped}, Failed: {Failed}",
                result.TotalReceived, result.Created, result.Updated, result.Unchanged, result.Skipped, result.Failed);
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
            _logger.LogError(ex, "Access group import failed");
        }

        return result;
    }
}
