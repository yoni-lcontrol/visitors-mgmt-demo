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
        var syncResult = await _deviceImportService.ImportAllAsync(cancellationToken);

        if (!syncResult.Success)
        {
            _logger.LogError("Device import failed: {Error}", syncResult.ErrorMessage);
            throw new InvalidOperationException($"Device import failed: {syncResult.ErrorMessage}");
        }

        _logger.LogInformation(
            "Device import completed. Created={Created}, Updated={Updated}, Failed={Failed}. Building response.",
            syncResult.Created, syncResult.Updated, syncResult.Failed);

        return await BuildDevicePayloadAsync(cancellationToken);
    }

    public async Task<AccessLevelCallbackPayload> ImportAccessLevelsAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting access-level import from Amadeus OData");
        var syncResult = await _accessImportRoutingService.ImportAsync(
            AccessImportType.AccessLevels, cancellationToken);

        if (!syncResult.Success)
        {
            _logger.LogError("Access-level import failed: {Error}", syncResult.ErrorMessage);
            throw new InvalidOperationException($"Access-level import failed: {syncResult.ErrorMessage}");
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
            }).ToList(),
        };
    }
}
