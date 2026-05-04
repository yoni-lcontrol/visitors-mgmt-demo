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

        var payload = BuildCreatePayload(dto);
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

        _dbContext.Cardholders.Add(entity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Cardholder created and persisted locally. AmadeusUid: {Uid}", entity.AmadeusUid);
        return MapToDto(entity);
    }

    public async Task UpdateCardholderAsync(string amadeusUid, CardholderUpdateDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Updating cardholder {Uid} via Amadeus API", amadeusUid);

        var payload = BuildUpdatePayload(dto);
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
            IsDeleted = entity.IsDeleted,
            IsArchived = entity.IsArchived,
            CreatedUtc = entity.CreatedUtc,
            UpdatedUtc = entity.UpdatedUtc
        };
    }

    public async Task<VisitorCreationResultDto> CreateVisitorAsync(CreateAmadeusVisitorDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting visitor creation in Amadeus");

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

        _logger.LogInformation("Visitor payload validated. Sending create request to Amadeus");

        try
        {
            var payload = BuildVisitorPayload(dto);
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
        catch (HttpRequestException ex) when (ex.Message.Contains("409") || ex.Message.Contains("Conflict", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogError(ex, "Failed to create visitor in Amadeus: duplicate cardholder or card number");
            return new VisitorCreationResultDto
            {
                Success = false,
                SyncStatus = "Failed",
                ErrorMessage = "Duplicate cardholder or card number in Amadeus",
                IsRetryable = false
            };
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

    private Dictionary<string, object?> BuildVisitorPayload(CreateAmadeusVisitorDto dto)
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
        if (dto.AccessGroupApiKeys is not null) payload["accessGroupApiKeys"] = string.Join(",", dto.AccessGroupApiKeys);
        if (dto.DepartmentUid is not null) payload["departmentUID"] = dto.DepartmentUid;
        if (dto.Notes is not null) payload["description"] = dto.Notes;

        return payload;
    }

    private static object BuildCreatePayload(CardholderCreateDto dto)
    {
        var payload = new Dictionary<string, object?>();

        if (dto.CardholderIdNumber is not null) payload["CardholderIdNumber"] = dto.CardholderIdNumber;
        if (dto.FirstName is not null) payload["FirstName"] = dto.FirstName;
        if (dto.LastName is not null) payload["LastName"] = dto.LastName;
        if (dto.Description is not null) payload["Description"] = dto.Description;
        if (dto.SecurityGroupApiKey is not null) payload["SecurityGroupApiKey"] = dto.SecurityGroupApiKey;
        if (dto.AccessGroupApiKeys is not null) payload["AccessGroupApiKeys"] = string.Join(",", dto.AccessGroupApiKeys);
        if (dto.FromDateValid.HasValue) payload["FromDateValid"] = dto.FromDateValid.Value;
        if (dto.ToDateValid.HasValue) payload["ToDateValid"] = dto.ToDateValid.Value;
        if (dto.IsFromDateActive.HasValue) payload["IsFromDateActive"] = dto.IsFromDateActive.Value;
        if (dto.IsToDateActive.HasValue) payload["IsToDateActive"] = dto.IsToDateActive.Value;

        return payload;
    }

    private static object BuildUpdatePayload(CardholderUpdateDto dto)
    {
        var payload = new Dictionary<string, object?>();

        if (dto.CardholderIdNumber is not null) payload["CardholderIdNumber"] = dto.CardholderIdNumber;
        if (dto.FirstName is not null) payload["FirstName"] = dto.FirstName;
        if (dto.LastName is not null) payload["LastName"] = dto.LastName;
        if (dto.Description is not null) payload["Description"] = dto.Description;
        if (dto.SecurityGroupApiKey is not null) payload["SecurityGroupApiKey"] = dto.SecurityGroupApiKey;
        if (dto.AccessGroupApiKeys is not null) payload["AccessGroupApiKeys"] = string.Join(",", dto.AccessGroupApiKeys);
        if (dto.FromDateValid.HasValue) payload["FromDateValid"] = dto.FromDateValid.Value;
        if (dto.ToDateValid.HasValue) payload["ToDateValid"] = dto.ToDateValid.Value;
        if (dto.IsFromDateActive.HasValue) payload["IsFromDateActive"] = dto.IsFromDateActive.Value;
        if (dto.IsToDateActive.HasValue) payload["IsToDateActive"] = dto.IsToDateActive.Value;

        return payload;
    }
}
