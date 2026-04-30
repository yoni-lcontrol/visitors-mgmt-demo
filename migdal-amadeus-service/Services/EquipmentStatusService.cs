using Amadeus8.Data;
using Amadeus8.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Services;

public class EquipmentStatusService : IEquipmentStatusService
{
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<EquipmentStatusService> _logger;

    public EquipmentStatusService(
        AmadeusDbContext dbContext,
        ILogger<EquipmentStatusService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<EquipmentStatusChangeResultDto> ChangeStatusAsync(
        EquipmentStatusChangeDto request,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Status change requested. EquipmentType={EquipmentType}, ExternalId={ExternalId}, IsActive={IsActive}",
            request.EquipmentType, request.ExternalId, request.IsActive);

        try
        {
            var updated = request.EquipmentType.ToLowerInvariant() switch
            {
                "controller" => await UpdateControllerStatusAsync(request.ExternalId, request.IsActive, cancellationToken),
                "door" => await UpdateDoorStatusAsync(request.ExternalId, request.IsActive, cancellationToken),
                "doorio" => await UpdateDoorIoStatusAsync(request.ExternalId, request.IsActive, cancellationToken),
                "extension" => await UpdateExtensionStatusAsync(request.ExternalId, request.IsActive, cancellationToken),
                "extensionio" => await UpdateExtensionIoStatusAsync(request.ExternalId, request.IsActive, cancellationToken),
                "accesslevel" => await UpdateAccessLevelStatusAsync(request.ExternalId, request.IsActive, cancellationToken),
                _ => throw new ArgumentException($"Unsupported equipment type: {request.EquipmentType}")
            };

            if (!updated)
            {
                _logger.LogWarning(
                    "Equipment not found for status change. EquipmentType={EquipmentType}, ExternalId={ExternalId}",
                    request.EquipmentType, request.ExternalId);

                return new EquipmentStatusChangeResultDto
                {
                    Success = false,
                    ErrorMessage = $"{request.EquipmentType} with ExternalId '{request.ExternalId}' not found",
                    ExternalId = request.ExternalId,
                    EquipmentType = request.EquipmentType,
                    IsActive = request.IsActive
                };
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Status change applied. EquipmentType={EquipmentType}, ExternalId={ExternalId}, IsActive={IsActive}",
                request.EquipmentType, request.ExternalId, request.IsActive);

            return new EquipmentStatusChangeResultDto
            {
                Success = true,
                ExternalId = request.ExternalId,
                EquipmentType = request.EquipmentType,
                IsActive = request.IsActive
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Status change failed. EquipmentType={EquipmentType}, ExternalId={ExternalId}",
                request.EquipmentType, request.ExternalId);

            return new EquipmentStatusChangeResultDto
            {
                Success = false,
                ErrorMessage = ex.Message,
                ExternalId = request.ExternalId,
                EquipmentType = request.EquipmentType,
                IsActive = request.IsActive
            };
        }
    }

    private async Task<bool> UpdateControllerStatusAsync(string externalId, bool isActive, CancellationToken ct)
    {
        var entity = await _dbContext.Controllers
            .FirstOrDefaultAsync(c => c.ExternalId == externalId, ct);
        if (entity is null) return false;
        entity.IsActive = isActive;
        entity.UpdatedUtc = DateTime.UtcNow;
        return true;
    }

    private async Task<bool> UpdateDoorStatusAsync(string externalId, bool isActive, CancellationToken ct)
    {
        var entity = await _dbContext.Doors
            .FirstOrDefaultAsync(d => d.ExternalId == externalId, ct);
        if (entity is null) return false;
        entity.IsActive = isActive;
        entity.UpdatedUtc = DateTime.UtcNow;
        return true;
    }

    private async Task<bool> UpdateDoorIoStatusAsync(string externalId, bool isActive, CancellationToken ct)
    {
        var entity = await _dbContext.DoorIos
            .FirstOrDefaultAsync(io => io.ExternalId == externalId, ct);
        if (entity is null) return false;
        entity.IsActive = isActive;
        entity.UpdatedUtc = DateTime.UtcNow;
        return true;
    }

    private async Task<bool> UpdateExtensionStatusAsync(string externalId, bool isActive, CancellationToken ct)
    {
        var entity = await _dbContext.Extensions
            .FirstOrDefaultAsync(e => e.ExternalId == externalId, ct);
        if (entity is null) return false;
        entity.IsActive = isActive;
        entity.UpdatedUtc = DateTime.UtcNow;
        return true;
    }

    private async Task<bool> UpdateExtensionIoStatusAsync(string externalId, bool isActive, CancellationToken ct)
    {
        var entity = await _dbContext.ExtensionIos
            .FirstOrDefaultAsync(io => io.ExternalId == externalId, ct);
        if (entity is null) return false;
        entity.IsActive = isActive;
        entity.UpdatedUtc = DateTime.UtcNow;
        return true;
    }

    private async Task<bool> UpdateAccessLevelStatusAsync(string externalId, bool isActive, CancellationToken ct)
    {
        // ExternalId on AccessLevel maps to either the ExternalId field or AmadeusUid
        var entity = await _dbContext.AccessLevels
            .FirstOrDefaultAsync(al => al.ExternalId == externalId || al.AmadeusUid == externalId, ct);
        if (entity is null) return false;
        entity.IsActive = isActive;
        entity.UpdatedUtc = DateTime.UtcNow;
        return true;
    }
}
