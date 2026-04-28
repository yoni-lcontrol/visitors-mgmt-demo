using Amadeus8.Data;
using Amadeus8.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Services;

public class ImportBridgeService : IImportBridgeService
{
    private readonly IDeviceImportService _deviceImportService;
    private readonly IAccessImportRoutingService _accessImportRoutingService;
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<ImportBridgeService> _logger;

    public ImportBridgeService(
        IDeviceImportService deviceImportService,
        IAccessImportRoutingService accessImportRoutingService,
        AmadeusDbContext dbContext,
        ILogger<ImportBridgeService> logger)
    {
        _deviceImportService = deviceImportService;
        _accessImportRoutingService = accessImportRoutingService;
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<ImportCallbackPayload> ImportDevicesAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting device import from Amadeus OData");
        SyncResultDto syncResult;
        try
        {
            syncResult = await _deviceImportService.ImportAllAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Device import execution threw an unexpected exception. Returning current topology snapshot from local database.");
            return await BuildDevicePayloadAsync(cancellationToken);
        }

        if (!syncResult.Success)
        {
            _logger.LogWarning(
                "Device import completed with failures. TotalReceived={TotalReceived}, Succeeded={Succeeded}, Failed={Failed}, Skipped={Skipped}, Error={Error}",
                syncResult.TotalReceived,
                syncResult.Succeeded,
                syncResult.Failed,
                syncResult.Skipped,
                syncResult.ErrorMessage);

            foreach (var failure in syncResult.Failures.Take(10))
            {
                _logger.LogWarning(
                    "Device import failure detail. EquipmentType={EquipmentType}, ExternalId={ExternalId}, Name={Name}, Stage={Stage}, Category={Category}, Message={Message}",
                    failure.EquipmentType,
                    failure.ExternalId,
                    failure.Name,
                    failure.FailureStage,
                    failure.FailureCategory,
                    failure.Message);
            }
        }

        _logger.LogInformation(
            "Device import completed. Created={Created}, Updated={Updated}, Failed={Failed}. Building response.",
            syncResult.Created, syncResult.Updated, syncResult.Failed);

        return await BuildDevicePayloadAsync(cancellationToken);
    }

    public async Task<AccessLevelCallbackPayload> ImportAccessLevelsAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting access-level import from Amadeus OData");
        SyncResultDto syncResult;
        try
        {
            syncResult = await _accessImportRoutingService.ImportAsync(
                AccessImportType.AccessLevels, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Access-level import execution threw an unexpected exception. Returning current access-level snapshot from local database.");
            return await BuildAccessLevelPayloadAsync(cancellationToken);
        }

        if (!syncResult.Success)
        {
            _logger.LogWarning(
                "Access-level import completed with failures. TotalReceived={TotalReceived}, Succeeded={Succeeded}, Failed={Failed}, Skipped={Skipped}, Error={Error}",
                syncResult.TotalReceived,
                syncResult.Succeeded,
                syncResult.Failed,
                syncResult.Skipped,
                syncResult.ErrorMessage);

            foreach (var failure in syncResult.Failures.Take(10))
            {
                _logger.LogWarning(
                    "Access-level import failure detail. EquipmentType={EquipmentType}, ExternalId={ExternalId}, Name={Name}, Stage={Stage}, Category={Category}, Message={Message}",
                    failure.EquipmentType,
                    failure.ExternalId,
                    failure.Name,
                    failure.FailureStage,
                    failure.FailureCategory,
                    failure.Message);
            }
        }

        _logger.LogInformation(
            "Access-level import completed. Created={Created}, Updated={Updated}, Failed={Failed}. Building response.",
            syncResult.Created, syncResult.Updated, syncResult.Failed);

        return await BuildAccessLevelPayloadAsync(cancellationToken);
    }

    private async Task<ImportCallbackPayload> BuildDevicePayloadAsync(CancellationToken cancellationToken)
    {
        var controllers = await _dbContext.Controllers
            .Include(c => c.Doors)
                .ThenInclude(d => d.DoorIos)
            .Include(c => c.Extensions)
                .ThenInclude(e => e.ExtensionIos)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new ImportCallbackPayload
        {
            Controllers = controllers.Select(c => new CallbackController
            {
                Name = c.Name,
                ExternalId = c.ExternalId,
                Active = c.IsActive,
                Doors = c.Doors.Select(d => new CallbackDoor
                {
                    Name = d.Name,
                    ExternalId = d.ExternalId,
                    DoorIos = d.DoorIos.Select(io => new CallbackIo
                    {
                        Name = io.Name,
                        ExternalId = io.ExternalId,
                        Type = io.IoType,
                    }).ToList(),
                }).ToList(),
                Extensions = c.Extensions.Select(e => new CallbackExtension
                {
                    Name = e.Name,
                    ExternalId = e.ExternalId,
                    ExtensionIos = e.ExtensionIos.Select(io => new CallbackIo
                    {
                        Name = io.Name,
                        ExternalId = io.ExternalId,
                        Type = io.IoType,
                    }).ToList(),
                }).ToList(),
            }).ToList(),
        };
    }

    private async Task<AccessLevelCallbackPayload> BuildAccessLevelPayloadAsync(CancellationToken cancellationToken)
    {
        var accessLevels = await _dbContext.AccessLevels
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return new AccessLevelCallbackPayload
        {
            AccessLevels = accessLevels.Select(al => new CallbackAccessLevel
            {
                Name = al.Name,
                Active = al.IsActive,
                VisitorAccess = false,
                ExternalId = al.ExternalId ?? al.AmadeusUid,
            }).ToList(),
        };
    }
}
