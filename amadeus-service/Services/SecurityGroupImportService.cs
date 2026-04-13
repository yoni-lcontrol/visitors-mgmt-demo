using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Configurations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class SecurityGroupImportService : ISecurityGroupImportService
{
    private readonly IAmadeusApiClient _apiClient;
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<SecurityGroupImportService> _logger;
    private readonly int _batchSize;

    public SecurityGroupImportService(
        IAmadeusApiClient apiClient,
        AmadeusDbContext dbContext,
        IOptions<AmadeusOptions> options,
        ILogger<SecurityGroupImportService> logger)
    {
        _apiClient = apiClient;
        _dbContext = dbContext;
        _batchSize = options.Value.AccessGroupsImportBatchSize;
        _logger = logger;
    }

    public async Task<SyncResultDto> ImportSecurityGroupsAsync(CancellationToken cancellationToken)
    {
        var result = new SyncResultDto { Operation = "ImportSecurityGroups", StartedUtc = DateTime.UtcNow };

        try
        {
            _logger.LogInformation("Importing security groups from Amadeus");
            var skip = 0;
            var batchIndex = 0;
            var processed = 0;
            int? totalCount = null;

            while (!cancellationToken.IsCancellationRequested)
            {
                batchIndex++;
                _logger.LogInformation("Security group batch {Batch} started. Skip={Skip}, Top={Top}", batchIndex, skip, _batchSize);

                var (externalGroups, count) = await _apiClient.GetSecurityGroupsPagedAsync(skip, _batchSize, cancellationToken);
                totalCount ??= count;

                if (externalGroups.Count == 0)
                {
                    _logger.LogInformation("Security group batch {Batch} returned no records; stopping paging loop", batchIndex);
                    break;
                }

                foreach (var ext in externalGroups)
                {
                    try
                    {
                        var existing = await _dbContext.SecurityGroups
                            .FirstOrDefaultAsync(g => g.AmadeusUid == ext.Id, cancellationToken);

                        if (existing is null)
                        {
                            var entity = new SecurityGroupEntity
                            {
                                AmadeusUid = ext.Id,
                                ApiKey = ext.ApiKey,
                                Name = ext.Name ?? ext.Id,
                                Description = ext.Description,
                                IsActive = true,
                                CreatedUtc = DateTime.UtcNow,
                                UpdatedUtc = DateTime.UtcNow
                            };
                            _dbContext.SecurityGroups.Add(entity);
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
                        _logger.LogError(ex, "Failed to upsert security group {Uid}", ext.Id);
                    }
                }

                await _dbContext.SaveChangesAsync(cancellationToken);
                _dbContext.ChangeTracker.Clear();

                processed += externalGroups.Count;
                skip += externalGroups.Count;

                _logger.LogInformation(
                    "Security group batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                    batchIndex,
                    externalGroups.Count,
                    processed,
                    totalCount);

                if (externalGroups.Count < _batchSize)
                {
                    break;
                }
            }

            result.Success = result.Failed == 0;
            result.CompletedUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "Security group import completed. Created: {Created}, Updated: {Updated}, Unchanged: {Unchanged}, Failed: {Failed}",
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
            _logger.LogError(ex, "Security group import failed");
        }

        return result;
    }
}
