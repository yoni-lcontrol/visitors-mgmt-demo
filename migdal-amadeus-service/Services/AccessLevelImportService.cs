using Amadeus8.Configurations;
using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class AccessLevelImportService : IAccessLevelImportService
{
    private const string AccessGroupSourceType = "AccessGroup";
    private const string SecurityGroupSourceType = "SecurityGroup";
    private const int AmadeusTopLimit = 50;

    private readonly IAmadeusApiClient _apiClient;
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<AccessLevelImportService> _logger;
    private readonly int _batchSize;

    public AccessLevelImportService(
        IAmadeusApiClient apiClient,
        AmadeusDbContext dbContext,
        IOptions<AmadeusOptions> options,
        ILogger<AccessLevelImportService> logger)
    {
        _apiClient = apiClient;
        _dbContext = dbContext;
        _batchSize = Math.Min(options.Value.AccessGroupsImportBatchSize, AmadeusTopLimit);
        _logger = logger;
    }

    public async Task<SyncResultDto> ImportAccessLevelsAsync(CancellationToken cancellationToken)
    {
        var result = new SyncResultDto
        {
            Operation = "ImportAccessLevels",
            StartedUtc = DateTime.UtcNow
        };

        try
        {
            _logger.LogInformation("Starting import of normalized access levels from Access Groups and Security Groups");

            await ImportFromAccessGroupsAsync(result, cancellationToken);
            await ImportFromSecurityGroupsAsync(result, cancellationToken);

            // Per-record failures are counted but do not fail the whole import run.
            result.Success = true;
            result.CompletedUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "Access levels import completed. TotalReceived={TotalReceived}, Created={Created}, Updated={Updated}, Unchanged={Unchanged}, Skipped={Skipped}, Failed={Failed}",
                result.TotalReceived,
                result.Created,
                result.Updated,
                result.Unchanged,
                result.Skipped,
                result.Failed);
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
            _logger.LogError(ex, "Access levels import failed");
        }

        return result;
    }

    private async Task ImportFromAccessGroupsAsync(SyncResultDto result, CancellationToken cancellationToken)
    {
        await ImportPagedAsync(
            sourceType: AccessGroupSourceType,
            fetchPage: (skip, top, ct) => _apiClient.GetAccessGroupsPagedAsync(skip, top, ct),
            map: g => new SourceGroupRecord(g.Id, g.ApiKey, g.Name, g.Description, g.Id),
            result,
            cancellationToken);
    }

    private async Task ImportFromSecurityGroupsAsync(SyncResultDto result, CancellationToken cancellationToken)
    {
        await ImportPagedAsync(
            sourceType: SecurityGroupSourceType,
            fetchPage: (skip, top, ct) => _apiClient.GetSecurityGroupsPagedAsync(skip, top, ct),
            map: g => new SourceGroupRecord(g.Id, g.ApiKey, g.Name, g.Description, g.Id),
            result,
            cancellationToken);
    }

    private async Task ImportPagedAsync<TSource>(
        string sourceType,
        Func<int, int, CancellationToken, Task<(List<TSource> Items, int? TotalCount)>> fetchPage,
        Func<TSource, SourceGroupRecord> map,
        SyncResultDto result,
        CancellationToken cancellationToken)
    {
        var skip = 0;
        var batchIndex = 0;
        int? totalCount = null;

        while (!cancellationToken.IsCancellationRequested)
        {
            batchIndex++;
            _logger.LogInformation(
                "{SourceType} access-level batch {Batch} started. Skip={Skip}, Top={Top}",
                sourceType,
                batchIndex,
                skip,
                _batchSize);

            var (items, count) = await fetchPage(skip, _batchSize, cancellationToken);
            totalCount ??= count;

            if (items.Count == 0)
            {
                _logger.LogInformation("{SourceType} access-level batch {Batch} returned no records", sourceType, batchIndex);
                break;
            }

            _logger.LogInformation(
                "Received {Count} {SourceType} records from Amadeus in batch {Batch}",
                items.Count,
                sourceType,
                batchIndex);

            result.TotalReceived += items.Count;

            foreach (var src in items)
            {
                try
                {
                    var mapped = map(src);
                    var validationError = Validate(mapped);
                    if (validationError is not null)
                    {
                        result.Skipped++;
                        _logger.LogWarning(
                            "Skipping {SourceType} record due to invalid data. Uid={Uid}, Reason={Reason}",
                            sourceType,
                            mapped.AmadeusUid,
                            validationError);
                        continue;
                    }

                    await UpsertAccessLevelAsync(sourceType, mapped, result, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    _logger.LogError(ex, "Failed to upsert access level from {SourceType}", sourceType);
                }
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            _dbContext.ChangeTracker.Clear();

            skip += items.Count;

            _logger.LogInformation(
                "{SourceType} access-level batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                sourceType,
                batchIndex,
                items.Count,
                skip,
                totalCount);

            if (items.Count < _batchSize)
            {
                break;
            }
        }
    }

    private async Task UpsertAccessLevelAsync(
        string sourceType,
        SourceGroupRecord source,
        SyncResultDto result,
        CancellationToken cancellationToken)
    {
        var existing = await _dbContext.AccessLevels.FirstOrDefaultAsync(
            x => x.SourceType == sourceType && x.AmadeusUid == source.AmadeusUid,
            cancellationToken);

        if (existing is null)
        {
            _logger.LogDebug("Creating access level from {SourceType} with UID {Uid}", sourceType, source.AmadeusUid);
            _dbContext.AccessLevels.Add(new AccessLevelEntity
            {
                SourceType = sourceType,
                AmadeusUid = source.AmadeusUid,
                ApiKey = source.ApiKey,
                Name = source.Name ?? source.AmadeusUid,
                Description = source.Description,
                ExternalId = source.ExternalId,
                IsActive = true,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            });
            result.Created++;
            return;
        }

        var changed = false;
        var mappedName = source.Name ?? source.AmadeusUid;

        if (existing.Name != mappedName) { existing.Name = mappedName; changed = true; }
        if (existing.ApiKey != source.ApiKey) { existing.ApiKey = source.ApiKey; changed = true; }
        if (existing.Description != source.Description) { existing.Description = source.Description; changed = true; }
        if (existing.ExternalId != source.ExternalId) { existing.ExternalId = source.ExternalId; changed = true; }
        // Note: IsActive is intentionally NOT overwritten during import — it is managed locally.

        if (changed)
        {
            _logger.LogDebug("Updating access level from {SourceType} with UID {Uid}", sourceType, source.AmadeusUid);
            existing.UpdatedUtc = DateTime.UtcNow;
            result.Updated++;
        }
        else
        {
            result.Unchanged++;
        }
    }

    private static string? Validate(SourceGroupRecord source)
    {
        if (string.IsNullOrWhiteSpace(source.AmadeusUid))
        {
            return "Missing uid";
        }

        return null;
    }

    private sealed record SourceGroupRecord(
        string AmadeusUid,
        string? ApiKey,
        string? Name,
        string? Description,
        string? ExternalId);
}
