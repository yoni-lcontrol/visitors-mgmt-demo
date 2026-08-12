using Amadeus8.Configurations;
using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class CardholderCommandService : ICardholderCommandService
{
    private readonly IAmadeusApiClient _apiClient;
    private readonly AmadeusDbContext _dbContext;
    private readonly AmadeusOptions _options;
    private readonly ILogger<CardholderCommandService> _logger;

    public CardholderCommandService(
        IAmadeusApiClient apiClient,
        AmadeusDbContext dbContext,
        IOptions<AmadeusOptions> options,
        ILogger<CardholderCommandService> logger)
    {
        _apiClient = apiClient;
        _dbContext = dbContext;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<CardholderDto> CreateCardholderAsync(CardholderCreateDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Creating cardholder via Amadeus API");

        var payload = await BuildCreatePayloadAsync(dto, cancellationToken);
        var created = await _apiClient.CreateCardholderAsync(payload, cancellationToken);

        var entity = new CardholderEntity
        {
            AmadeusUid = created.Id,
            CardholderIdNumber = created.CardholderIdNumber ?? dto.CardholderIdNumber,
            FirstName = created.FirstName ?? dto.FirstName,
            LastName = created.LastName ?? dto.LastName,
            Description = created.Description ?? dto.Description,
            SecurityGroupUid = created.SecurityGroupId,
            SecurityGroupApiKey = created.SecurityGroupApiKey ?? dto.SecurityGroupApiKey,
            AccessGroupUidsRaw = created.AccessGroupIds,
            AccessGroupApiKeysRaw = created.AccessGroupApiKeys ?? (dto.AccessGroupApiKeys != null ? string.Join(",", dto.AccessGroupApiKeys) : null),
            Status = created.Status,
            FromDateValidUtc = created.FromDateValid?.ToUniversalTime() ?? dto.FromDateValid?.ToUniversalTime(),
            ToDateValidUtc = created.ToDateValid?.ToUniversalTime() ?? dto.ToDateValid?.ToUniversalTime(),
            IsFromDateActive = created.IsFromDateActive ?? dto.IsFromDateActive ?? false,
            IsToDateActive = created.IsToDateActive ?? dto.IsToDateActive ?? false,
            IsDeleted = false,
            IsArchived = false,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

        if (!string.IsNullOrWhiteSpace(dto.LicensePlate))
        {
            await _apiClient.UpsertLicensePlateAsync(created.Id, dto.LicensePlate, cancellationToken);
            entity.LicensePlate = dto.LicensePlate;
        }

        _dbContext.Cardholders.Add(entity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cardholder created and persisted locally. AmadeusUid: {Uid}", entity.AmadeusUid);
        return MapToDto(entity);
    }

    public async Task UpdateCardholderAsync(string amadeusUid, CardholderUpdateDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Updating cardholder {Uid} via Amadeus API", amadeusUid);

        var payload = await BuildUpdatePayloadAsync(dto, cancellationToken);
        await _apiClient.UpdateCardholderAsync(amadeusUid, payload, cancellationToken);

        var entity = await _dbContext.Cardholders
            .FirstOrDefaultAsync(c => c.AmadeusUid == amadeusUid, cancellationToken);

        if (entity is not null)
        {
            if (dto.CardholderIdNumber is not null) entity.CardholderIdNumber = dto.CardholderIdNumber;
            if (dto.FirstName is not null) entity.FirstName = dto.FirstName;
            if (dto.LastName is not null) entity.LastName = dto.LastName;
            if (dto.Description is not null) entity.Description = dto.Description;
            if (dto.SecurityGroupApiKey is not null) entity.SecurityGroupApiKey = dto.SecurityGroupApiKey;
            if (dto.AccessGroupApiKeys is not null) entity.AccessGroupApiKeysRaw = string.Join(",", dto.AccessGroupApiKeys);
            if (dto.FromDateValid.HasValue) entity.FromDateValidUtc = dto.FromDateValid.Value.ToUniversalTime();
            if (dto.ToDateValid.HasValue) entity.ToDateValidUtc = dto.ToDateValid.Value.ToUniversalTime();
            if (dto.IsFromDateActive.HasValue) entity.IsFromDateActive = dto.IsFromDateActive.Value;
            if (dto.IsToDateActive.HasValue) entity.IsToDateActive = dto.IsToDateActive.Value;
            entity.UpdatedUtc = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        _logger.LogInformation("Cardholder {Uid} updated", amadeusUid);
    }

    public async Task<bool> ActivateCardholderByIdNumberAsync(string cardholderIdNumber, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Activating cardholder by CardholderIdNumber {IdNumber}", cardholderIdNumber);

        var entity = await _dbContext.Cardholders
            .FirstOrDefaultAsync(c => c.CardholderIdNumber == cardholderIdNumber && !c.IsDeleted, cancellationToken);

        if (entity is null)
        {
            _logger.LogWarning("Cardholder with CardholderIdNumber {IdNumber} not found locally", cardholderIdNumber);
            return false;
        }

        var fromDateValid = entity.IsFromDateActive && entity.FromDateValidUtc.HasValue && entity.FromDateValidUtc.Value <= DateTime.UtcNow
            ? entity.FromDateValidUtc.Value
            : DateTime.UtcNow;

        var payload = new Dictionary<string, object?>
        {
            ["isFromDateActive"] = true,
            ["fromDateValid"] = fromDateValid,
        };

        await _apiClient.UpdateCardholderAsync(entity.AmadeusUid, payload, cancellationToken);

        entity.IsFromDateActive = true;
        entity.FromDateValidUtc = fromDateValid;
        entity.UpdatedUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cardholder {Uid} (idNumber {IdNumber}) activated", entity.AmadeusUid, cardholderIdNumber);
        return true;
    }

    public async Task<VisitorCreationResultDto> DeleteVisitorAsync(string amadeusUid, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting visitor deletion from Amadeus. AmadeusUid: {Uid}", amadeusUid);

        if (string.IsNullOrWhiteSpace(amadeusUid))
        {
            _logger.LogWarning("DeleteVisitor called with empty AmadeusUid");
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = "AmadeusUid is required",
                IsRetryable = false
            };
        }

        var entity = await _dbContext.Cardholders
            .FirstOrDefaultAsync(c => c.AmadeusUid == amadeusUid, cancellationToken);

        if (entity is null)
        {
            _logger.LogWarning("Visitor {Uid} not found locally", amadeusUid);
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = "Visitor not found",
                IsRetryable = false
            };
        }

        if (string.IsNullOrWhiteSpace(_options.VisitorCardholderTypeUid))
        {
            _logger.LogError("VisitorCardholderTypeUid is not configured. Cannot verify visitor type");
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = "Visitor cardholder type UID is not configured",
                IsRetryable = false
            };
        }

        if (entity.CardholderTypeUid != _options.VisitorCardholderTypeUid)
        {
            _logger.LogWarning("Cardholder {Uid} is not a visitor. CardholderTypeUid: {TypeUid}", amadeusUid, entity.CardholderTypeUid);
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = "Cardholder is not a visitor",
                IsRetryable = false
            };
        }

        try
        {
            _logger.LogInformation("Sending delete visitor request to Amadeus. AmadeusUid: {Uid}", amadeusUid);
            await _apiClient.DeleteCardholderAsync(amadeusUid, cancellationToken);

            entity.IsDeleted = true;
            entity.UpdatedUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Visitor deleted successfully from Amadeus. AmadeusUid: {Uid}", amadeusUid);

            return new VisitorCreationResultDto
            {
                Success = true,
                AmadeusExternalId = amadeusUid,
                SyncStatus = "Deleted",
                LastSyncedAtUtc = DateTime.UtcNow
            };
        }
        catch (HttpRequestException ex) when (ex.Message.Contains("404") || ex.Message.Contains("NotFound", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(ex, "Visitor {Uid} not found in Amadeus. Marking as deleted locally", amadeusUid);
            entity.IsDeleted = true;
            entity.UpdatedUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);

            return new VisitorCreationResultDto
            {
                Success = true,
                AmadeusExternalId = amadeusUid,
                SyncStatus = "Deleted",
                LastSyncedAtUtc = DateTime.UtcNow
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to delete visitor {Uid} from Amadeus", amadeusUid);
            return new VisitorCreationResultDto
            {
                Success = false,
                AmadeusExternalId = amadeusUid,
                SyncStatus = "Failed",
                ErrorMessage = $"Amadeus API error: {ex.Message}",
                IsRetryable = true
            };
        }
    }

    public async Task DeleteCardholderAsync(string amadeusUid, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Deleting cardholder {Uid} via Amadeus API", amadeusUid);

        await _apiClient.DeleteCardholderAsync(amadeusUid, cancellationToken);

        var entity = await _dbContext.Cardholders
            .FirstOrDefaultAsync(c => c.AmadeusUid == amadeusUid, cancellationToken);

        if (entity is not null)
        {
            entity.IsDeleted = true;
            entity.UpdatedUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        _logger.LogInformation("Cardholder {Uid} marked as deleted", amadeusUid);
    }

    public async Task ArchiveCardholderAsync(string amadeusUid, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Archiving cardholder {Uid}", amadeusUid);

        // Archive via PATCH with appropriate status or dedicated endpoint
        // TODO: Verify exact archive endpoint/payload from Amadeus vendor guide
        var payload = new { Status = "Archived" };
        await _apiClient.UpdateCardholderAsync(amadeusUid, payload, cancellationToken);

        var entity = await _dbContext.Cardholders
            .FirstOrDefaultAsync(c => c.AmadeusUid == amadeusUid, cancellationToken);

        if (entity is not null)
        {
            entity.IsArchived = true;
            entity.Status = "Archived";
            entity.UpdatedUtc = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        _logger.LogInformation("Cardholder {Uid} archived", amadeusUid);
    }

    public async Task<CardholderDto?> GetCardholderByUidAsync(string amadeusUid, CancellationToken cancellationToken)
    {
        var entity = await _dbContext.Cardholders
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.AmadeusUid == amadeusUid, cancellationToken);

        return entity is not null ? MapToDto(entity) : null;
    }

    public async Task<List<CardholderDto>> GetCardholdersAsync(CancellationToken cancellationToken)
    {
        var entities = await _dbContext.Cardholders
            .AsNoTracking()
            .Where(c => !c.IsDeleted)
            .OrderBy(c => c.LastName)
            .ThenBy(c => c.FirstName)
            .ToListAsync(cancellationToken);

        return entities.Select(MapToDto).ToList();
    }

    private static CardholderDto MapToDto(CardholderEntity entity)
    {
        return new CardholderDto
        {
            Id = entity.Id,
            AmadeusUid = entity.AmadeusUid,
            CardholderIdNumber = entity.CardholderIdNumber,
            FirstName = entity.FirstName,
            LastName = entity.LastName,
            Description = entity.Description,
            Status = entity.Status,
            SecurityGroupUid = entity.SecurityGroupUid,
            SecurityGroupApiKey = entity.SecurityGroupApiKey,
            AccessGroupUidsRaw = entity.AccessGroupUidsRaw,
            AccessGroupApiKeysRaw = entity.AccessGroupApiKeysRaw,
            LicensePlate = entity.LicensePlate,
            IsDeleted = entity.IsDeleted,
            IsArchived = entity.IsArchived,
            CreatedUtc = entity.CreatedUtc,
            UpdatedUtc = entity.UpdatedUtc
        };
    }

    public async Task<VisitorCreationResultDto> CreateVisitorAsync(CreateAmadeusVisitorDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting visitor create-or-update in Amadeus for {PersonId}", dto.CardholderIdNumber);

        // Validate configuration
        if (string.IsNullOrWhiteSpace(_options.VisitorCardholderTypeUid))
        {
            _logger.LogError("VisitorCardholderTypeUid is not configured. Cannot create visitor in Amadeus");
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = "Visitor cardholder type UID is not configured",
                IsRetryable = false
            };
        }

        // Validate required fields
        var validationError = ValidateVisitorDto(dto);
        if (validationError is not null)
        {
            _logger.LogWarning("Visitor payload validation failed: {Reason}", validationError);
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = validationError,
                IsRetryable = false
            };
        }

        // Check if visitor already exists locally by CardholderIdNumber
        var existingEntity = !string.IsNullOrWhiteSpace(dto.CardholderIdNumber)
            ? await _dbContext.Cardholders.FirstOrDefaultAsync(
                c => c.CardholderIdNumber == dto.CardholderIdNumber
                     && c.CardholderTypeUid == _options.VisitorCardholderTypeUid
                     && !c.IsDeleted,
                cancellationToken)
            : null;

        if (existingEntity is not null)
        {
            return await UpdateExistingVisitorAsync(existingEntity, dto, cancellationToken);
        }

        _logger.LogInformation("Visitor not found locally. Sending create request to Amadeus");

        try
        {
            var payload = await BuildVisitorPayloadAsync(dto, cancellationToken);
            var created = await _apiClient.CreateCardholderAsync(payload, cancellationToken);

            var entity = new CardholderEntity
            {
                AmadeusUid = created.Id,
                CardholderIdNumber = created.CardholderIdNumber ?? dto.CardholderIdNumber,
                FirstName = created.FirstName ?? dto.FirstName,
                LastName = created.LastName ?? dto.LastName,
                Description = created.Description ?? dto.Notes,
                CardholderTypeUid = created.CardholderTypeId ?? _options.VisitorCardholderTypeUid,
                DepartmentUid = created.DepartmentId ?? dto.DepartmentUid,
                SecurityGroupUid = created.SecurityGroupId,
                SecurityGroupApiKey = created.SecurityGroupApiKey ?? dto.SecurityGroupApiKey,
                AccessGroupUidsRaw = created.AccessGroupIds,
                AccessGroupApiKeysRaw = created.AccessGroupApiKeys ?? (dto.AccessGroupApiKeys != null ? string.Join(",", dto.AccessGroupApiKeys) : null),
                Status = created.Status ?? "Active",
                FromDateValidUtc = created.FromDateValid?.ToUniversalTime() ?? dto.FromDateValid.ToUniversalTime(),
                ToDateValidUtc = created.ToDateValid?.ToUniversalTime() ?? dto.ToDateValid.ToUniversalTime(),
                IsFromDateActive = created.IsFromDateActive ?? true,
                IsToDateActive = created.IsToDateActive ?? true,
                IsDeleted = false,
                IsArchived = false,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };

            _dbContext.Cardholders.Add(entity);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Amadeus visitor created successfully. AmadeusUid: {Uid}", entity.AmadeusUid);

            return new VisitorCreationResultDto
            {
                Success = true,
                AmadeusExternalId = entity.AmadeusUid,
                SyncStatus = "Synced",
                LastSyncedAtUtc = DateTime.UtcNow
            };
        }
        catch (HttpRequestException ex) when (ex.Message.Contains("409") || ex.Message.Contains("Conflict", StringComparison.OrdinalIgnoreCase)
            || ex.Message.Contains("422") || ex.Message.Contains("UnprocessableEntity", StringComparison.OrdinalIgnoreCase)
            || ex.Message.Contains("ThereIsAlreadyACardholderName", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(ex, "Visitor already exists in Amadeus. Attempting to find and update");
            return await HandleConflictAndUpdateAsync(dto, cancellationToken);
        }
        catch (HttpRequestException ex) when (ex.Message.Contains("400") || ex.Message.Contains("BadRequest", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogError(ex, "Failed to create visitor in Amadeus: invalid request payload");
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = $"Invalid request: {ex.Message}",
                IsRetryable = false
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to create visitor in Amadeus: API communication error");
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = $"Amadeus API error: {ex.Message}",
                IsRetryable = true
            };
        }
    }

    private async Task<VisitorCreationResultDto> UpdateExistingVisitorAsync(CardholderEntity existingEntity, CreateAmadeusVisitorDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Visitor {PersonId} already exists locally (AmadeusUid: {Uid}). Updating properties in Amadeus",
            dto.CardholderIdNumber, existingEntity.AmadeusUid);

        try
        {
            var payload = await BuildVisitorPayloadAsync(dto, cancellationToken);

            // Check if cardholder still exists in Amadeus; if deleted remotely, resolve correct UID
            var remoteCardholder = await _apiClient.GetCardholderByUidAsync(existingEntity.AmadeusUid, cancellationToken);
            if (remoteCardholder == null)
            {
                _logger.LogWarning("Cardholder {Uid} not found in Amadeus by UID. Searching by CardholderIdNumber {PersonId}",
                    existingEntity.AmadeusUid, dto.CardholderIdNumber);

                // Search Amadeus for the cardholder by ID number to get the correct UID
                var resolvedUid = await FindCardholderUidByIdNumberAsync(dto.CardholderIdNumber, cancellationToken);
                if (resolvedUid is not null)
                {
                    _logger.LogInformation("Found cardholder in Amadeus under different UID {NewUid}. Updating", resolvedUid);

                    // Remove any duplicate local entity that already has this UID to avoid UNIQUE constraint violation
                    var duplicateEntity = await _dbContext.Cardholders
                        .FirstOrDefaultAsync(c => c.AmadeusUid == resolvedUid && c.Id != existingEntity.Id, cancellationToken);
                    if (duplicateEntity is not null)
                    {
                        _logger.LogWarning("Removing duplicate local entity (Id={DupId}) with AmadeusUid {Uid}", duplicateEntity.Id, resolvedUid);
                        _dbContext.Cardholders.Remove(duplicateEntity);
                    }

                    existingEntity.AmadeusUid = resolvedUid;
                    await _apiClient.UpdateCardholderAsync(resolvedUid, payload, cancellationToken);
                }
                else
                {
                    _logger.LogInformation("Cardholder not found in Amadeus at all. Re-creating visitor {PersonId}", dto.CardholderIdNumber);
                    var created = await _apiClient.CreateCardholderAsync(payload, cancellationToken);
                    existingEntity.AmadeusUid = created.Id;
                }
            }
            else
            {
                await _apiClient.UpdateCardholderAsync(existingEntity.AmadeusUid, payload, cancellationToken);
            }

            // Update local entity
            existingEntity.FirstName = dto.FirstName;
            existingEntity.LastName = dto.LastName;
            existingEntity.Description = dto.Notes;
            existingEntity.FromDateValidUtc = dto.FromDateValid.ToUniversalTime();
            existingEntity.ToDateValidUtc = dto.ToDateValid.ToUniversalTime();
            existingEntity.SecurityGroupApiKey = dto.SecurityGroupApiKey;
            existingEntity.AccessGroupApiKeysRaw = dto.AccessGroupApiKeys != null ? string.Join(",", dto.AccessGroupApiKeys) : existingEntity.AccessGroupApiKeysRaw;
            existingEntity.DepartmentUid = dto.DepartmentUid ?? existingEntity.DepartmentUid;
            existingEntity.UpdatedUtc = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Amadeus visitor updated successfully. AmadeusUid: {Uid}", existingEntity.AmadeusUid);

            return new VisitorCreationResultDto
            {
                Success = true,
                AmadeusExternalId = existingEntity.AmadeusUid,
                SyncStatus = "Synced",
                LastSyncedAtUtc = DateTime.UtcNow
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to update existing visitor {Uid} in Amadeus", existingEntity.AmadeusUid);
            return new VisitorCreationResultDto
            {
                Success = false,
                AmadeusExternalId = existingEntity.AmadeusUid,
                SyncStatus = "Failed",
                ErrorMessage = $"Amadeus API error: {ex.Message}",
                IsRetryable = true
            };
        }
    }

    private async Task<VisitorCreationResultDto> HandleConflictAndUpdateAsync(CreateAmadeusVisitorDto dto, CancellationToken cancellationToken)
    {
        // Try to find the existing visitor in Amadeus by paging through cardholders
        // and matching by CardholderIdNumber
        if (string.IsNullOrWhiteSpace(dto.CardholderIdNumber))
        {
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = "Visitor already exists in Amadeus but CardholderIdNumber is empty — cannot locate for update",
                IsRetryable = false
            };
        }

        // Search local DB first (might have been created by sync)
        var localEntity = await _dbContext.Cardholders.FirstOrDefaultAsync(
            c => c.CardholderIdNumber == dto.CardholderIdNumber && !c.IsDeleted,
            cancellationToken);

        if (localEntity is not null)
        {
            return await UpdateExistingVisitorAsync(localEntity, dto, cancellationToken);
        }

        // Not in local DB — search Amadeus API
        _logger.LogInformation("Searching Amadeus for existing visitor with personId {PersonId}", dto.CardholderIdNumber);
        var skip = 0;
        const int pageSize = 100;
        string? foundUid = null;

        while (true)
        {
            var (items, _) = await _apiClient.GetCardholdersPagedAsync(skip, pageSize, cancellationToken);
            var match = items.FirstOrDefault(c => c.CardholderIdNumber == dto.CardholderIdNumber);
            if (match is not null)
            {
                foundUid = match.Id;
                break;
            }
            if (items.Count < pageSize) break;
            skip += pageSize;
        }

        if (foundUid is null)
        {
            _logger.LogWarning("Could not find existing visitor {PersonId} in Amadeus after conflict", dto.CardholderIdNumber);
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = "Visitor conflict in Amadeus but unable to locate existing record for update",
                IsRetryable = false
            };
        }

        _logger.LogInformation("Found existing visitor in Amadeus. AmadeusUid: {Uid}. Updating", foundUid);

        try
        {
            var payload = await BuildVisitorPayloadAsync(dto, cancellationToken);
            await _apiClient.UpdateCardholderAsync(foundUid, payload, cancellationToken);

            // Persist locally
            var entity = new CardholderEntity
            {
                AmadeusUid = foundUid,
                CardholderIdNumber = dto.CardholderIdNumber,
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                Description = dto.Notes,
                CardholderTypeUid = _options.VisitorCardholderTypeUid,
                DepartmentUid = dto.DepartmentUid,
                SecurityGroupApiKey = dto.SecurityGroupApiKey,
                AccessGroupApiKeysRaw = dto.AccessGroupApiKeys != null ? string.Join(",", dto.AccessGroupApiKeys) : null,
                Status = "Active",
                FromDateValidUtc = dto.FromDateValid.ToUniversalTime(),
                ToDateValidUtc = dto.ToDateValid.ToUniversalTime(),
                IsFromDateActive = true,
                IsToDateActive = true,
                IsDeleted = false,
                IsArchived = false,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };

            _dbContext.Cardholders.Add(entity);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return new VisitorCreationResultDto
            {
                Success = true,
                AmadeusExternalId = foundUid,
                SyncStatus = "Synced",
                LastSyncedAtUtc = DateTime.UtcNow
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to update visitor {Uid} in Amadeus after conflict", foundUid);
            return new VisitorCreationResultDto
            {
                Success = false,
                AmadeusExternalId = foundUid,
                SyncStatus = "Failed",
                ErrorMessage = $"Amadeus API error: {ex.Message}",
                IsRetryable = true
            };
        }
    }

    private async Task<string?> FindCardholderUidByIdNumberAsync(string? cardholderIdNumber, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(cardholderIdNumber))
            return null;

        var match = await _apiClient.GetCardholderByIdNumberAsync(cardholderIdNumber, cancellationToken);
        return match?.Id;
    }

    private static string? ValidateVisitorDto(CreateAmadeusVisitorDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FirstName))
            return "FirstName is required";

        if (string.IsNullOrWhiteSpace(dto.LastName))
            return "LastName is required";

        if (dto.FromDateValid == default)
            return "FromDateValid is required";

        if (dto.ToDateValid == default)
            return "ToDateValid is required";

        if (dto.ToDateValid <= dto.FromDateValid)
            return "ToDateValid must be after FromDateValid";

        if (dto.ToDateValid <= DateTime.UtcNow)
            return "ToDateValid must be in the future";

        return null;
    }

    private async Task<string?> ResolveAccessGroupUidsAsync(List<string> apiKeys, CancellationToken cancellationToken)
    {
        var groups = await _dbContext.AccessGroups
            .AsNoTracking()
            .Where(g => apiKeys.Contains(g.ApiKey!) || apiKeys.Contains(g.AmadeusUid))
            .ToListAsync(cancellationToken);

        var uids = new List<string>();
        foreach (var key in apiKeys)
        {
            var group = groups.FirstOrDefault(g => g.ApiKey == key || g.AmadeusUid == key);
            uids.Add(group?.AmadeusUid ?? key);
        }

        return uids.Count > 0 ? string.Join(";", uids) : null;
    }

    private Task<Dictionary<string, object?>> BuildVisitorPayloadAsync(CreateAmadeusVisitorDto dto, CancellationToken cancellationToken)
    {
        var payload = new Dictionary<string, object?>
        {
            ["firstName"] = dto.FirstName,
            ["lastName"] = dto.LastName,
            ["cardholderTypeUID"] = _options.VisitorCardholderTypeUid,
            ["fromDateValid"] = dto.FromDateValid,
            ["toDateValid"] = dto.ToDateValid,
            ["isFromDateActive"] = true,
            ["isToDateActive"] = true
        };

        if (dto.CardholderIdNumber is not null) payload["cardholderIdNumber"] = dto.CardholderIdNumber;
        if (dto.SecurityGroupApiKey is not null) payload["securityGroupApiKey"] = dto.SecurityGroupApiKey;
        if (dto.AccessGroupApiKeys is not null && dto.AccessGroupApiKeys.Count > 0)
        {
            payload["accessGroupApiKeys"] = string.Join(",", dto.AccessGroupApiKeys);
        }
        else if (!string.IsNullOrWhiteSpace(_options.VisitorDefaultAccessGroupApiKey))
        {
            payload["accessGroupApiKeys"] = _options.VisitorDefaultAccessGroupApiKey;
        }
        if (dto.DepartmentUid is not null) payload["departmentUID"] = dto.DepartmentUid;
        if (dto.Notes is not null) payload["description"] = dto.Notes;

        return Task.FromResult(payload);
    }

    private async Task<object> BuildCreatePayloadAsync(CardholderCreateDto dto, CancellationToken cancellationToken)
    {
        var payload = new Dictionary<string, object?>();

        if (dto.CardholderIdNumber is not null) payload["cardholderIdNumber"] = dto.CardholderIdNumber;
        if (dto.FirstName is not null) payload["firstName"] = dto.FirstName;
        if (dto.LastName is not null) payload["lastName"] = dto.LastName;
        if (dto.Description is not null) payload["description"] = dto.Description;
        if (dto.CardholderTypeUid is not null) payload["cardholderTypeUID"] = dto.CardholderTypeUid;
        if (dto.SecurityGroupApiKey is not null) payload["securityGroupApiKey"] = dto.SecurityGroupApiKey;
        if (dto.AccessGroupApiKeys is not null)
        {
            var resolved = await ResolveAccessGroupUidsAsync(dto.AccessGroupApiKeys, cancellationToken);
            if (resolved is not null) payload["accessGroupUIDs"] = resolved;
        }
        if (dto.FromDateValid.HasValue) payload["fromDateValid"] = dto.FromDateValid.Value;
        if (dto.ToDateValid.HasValue) payload["toDateValid"] = dto.ToDateValid.Value;
        if (dto.IsFromDateActive.HasValue) payload["isFromDateActive"] = dto.IsFromDateActive.Value;
        if (dto.IsToDateActive.HasValue) payload["isToDateActive"] = dto.IsToDateActive.Value;

        return payload;
    }

    private async Task<object> BuildUpdatePayloadAsync(CardholderUpdateDto dto, CancellationToken cancellationToken)
    {
        var payload = new Dictionary<string, object?>();

        if (dto.CardholderIdNumber is not null) payload["cardholderIdNumber"] = dto.CardholderIdNumber;
        if (dto.FirstName is not null) payload["firstName"] = dto.FirstName;
        if (dto.LastName is not null) payload["lastName"] = dto.LastName;
        if (dto.Description is not null) payload["description"] = dto.Description;
        if (dto.SecurityGroupApiKey is not null) payload["securityGroupApiKey"] = dto.SecurityGroupApiKey;
        if (dto.AccessGroupApiKeys is not null)
        {
            var resolved = await ResolveAccessGroupUidsAsync(dto.AccessGroupApiKeys, cancellationToken);
            if (resolved is not null) payload["accessGroupUIDs"] = resolved;
        }
        if (dto.FromDateValid.HasValue) payload["fromDateValid"] = dto.FromDateValid.Value;
        if (dto.ToDateValid.HasValue) payload["toDateValid"] = dto.ToDateValid.Value;
        if (dto.IsFromDateActive.HasValue) payload["isFromDateActive"] = dto.IsFromDateActive.Value;
        if (dto.IsToDateActive.HasValue) payload["isToDateActive"] = dto.IsToDateActive.Value;

        return payload;
    }
}
