using Amadeus8.Data;
using Amadeus8.Models;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Services;

/// <summary>
/// Resolves the physical equipment entity related to an incoming Amadeus event
/// by searching the local database in a defined priority order.
/// </summary>
/// <remarks>
/// Resolution strategies (in order):
/// 1. readerUID → DoorEntity.ReaderExternalId   (reader UID belongs to a door reader port)
/// 2. readerUID → DoorEntity.ExternalId          (fallback: door UID used as reader UID)
///
/// Add new strategies below as additional equipment types are supported.
/// Each strategy is a private method returning null when not matched.
/// </remarks>
public sealed class EquipmentResolverService : IEquipmentResolverService
{
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<EquipmentResolverService> _logger;

    public EquipmentResolverService(
        AmadeusDbContext dbContext,
        ILogger<EquipmentResolverService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<EquipmentResolutionResult> ResolveAsync(
        AmadeusEventContext context,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(context.ReaderUid))
        {
            var result = await TryResolveDoorByReaderExternalIdAsync(context.ReaderUid, cancellationToken);
            if (result is not null)
            {
                _logger.LogDebug(
                    "Equipment resolved via ReaderExternalId: Door={DoorName} (ExternalId={ExternalId}, IsActive={IsActive})",
                    result.EquipmentName, result.EquipmentExternalId, result.IsActive);
                return result;
            }
        }

        if (!string.IsNullOrEmpty(context.ReaderUid))
        {
            var result = await TryResolveDoorByExternalIdAsync(context.ReaderUid, cancellationToken);
            if (result is not null)
            {
                _logger.LogDebug(
                    "Equipment resolved via Door.ExternalId fallback: Door={DoorName} (ExternalId={ExternalId}, IsActive={IsActive})",
                    result.EquipmentName, result.EquipmentExternalId, result.IsActive);
                return result;
            }
        }

        if (!string.IsNullOrEmpty(context.InputUid))
        {
            var result = await TryResolveDoorIoAsync(context.InputUid, cancellationToken);
            if (result is not null)
            {
                _logger.LogDebug(
                    "Equipment resolved via DoorIo input UID: DoorIo={DoorIoName} (ExternalId={ExternalId}, IsActive={IsActive})",
                    result.EquipmentName, result.EquipmentExternalId, result.IsActive);
                return result;
            }

            result = await TryResolveExtensionIoAsync(context.InputUid, cancellationToken);
            if (result is not null)
            {
                _logger.LogDebug(
                    "Equipment resolved via ExtensionIo input UID: ExtensionIo={ExtensionIoName} (ExternalId={ExternalId}, IsActive={IsActive})",
                    result.EquipmentName, result.EquipmentExternalId, result.IsActive);
                return result;
            }
        }

        if (!string.IsNullOrEmpty(context.OutputUid))
        {
            var result = await TryResolveDoorIoAsync(context.OutputUid, cancellationToken);
            if (result is not null)
            {
                _logger.LogDebug(
                    "Equipment resolved via DoorIo output UID: DoorIo={DoorIoName} (ExternalId={ExternalId}, IsActive={IsActive})",
                    result.EquipmentName, result.EquipmentExternalId, result.IsActive);
                return result;
            }

            result = await TryResolveExtensionIoAsync(context.OutputUid, cancellationToken);
            if (result is not null)
            {
                _logger.LogDebug(
                    "Equipment resolved via ExtensionIo output UID: ExtensionIo={ExtensionIoName} (ExternalId={ExternalId}, IsActive={IsActive})",
                    result.EquipmentName, result.EquipmentExternalId, result.IsActive);
                return result;
            }
        }

        if (!string.IsNullOrEmpty(context.ControllerUid))
        {
            var result = await TryResolveControllerAsync(context.ControllerUid, cancellationToken);
            if (result is not null)
            {
                _logger.LogDebug(
                    "Equipment resolved via ControllerUID: Controller={ControllerName} (ExternalId={ExternalId}, IsActive={IsActive})",
                    result.EquipmentName, result.EquipmentExternalId, result.IsActive);
                return result;
            }
        }

        // Strategy 1: readerUID → Door.ReaderExternalId
        _logger.LogDebug(
            "No matching equipment found in local database for event {Method} readerUID={ReaderUid}",
            context.SignalRMethodName, context.ReaderUid ?? "(none)");

        return EquipmentResolutionResult.NotFound;
    }

    // ── private resolution strategies ────────────────────────────────────────

    private async Task<EquipmentResolutionResult?> TryResolveDoorByReaderExternalIdAsync(
        string readerUid,
        CancellationToken cancellationToken)
    {
        var door = await _dbContext.Doors
            .AsNoTracking()
            .Where(d => d.ReaderExternalId == readerUid)
            .Select(d => new
            {
                d.ExternalId,
                d.Name,
                IsActive = d.IsActive && d.Controller.IsActive,
                ControllerExternalId = d.Controller.ExternalId
            })
            .FirstOrDefaultAsync(cancellationToken);

        return door is null ? null : new EquipmentResolutionResult
        {
            IsFound              = true,
            IsActive             = door.IsActive,
            EquipmentKind        = EquipmentKind.Door,
            EquipmentExternalId  = door.ExternalId,
            EquipmentName        = door.Name,
            ControllerExternalId = door.ControllerExternalId
        };
    }

    private async Task<EquipmentResolutionResult?> TryResolveDoorByExternalIdAsync(
        string externalId,
        CancellationToken cancellationToken)
    {
        var door = await _dbContext.Doors
            .AsNoTracking()
            .Where(d => d.ExternalId == externalId)
            .Select(d => new
            {
                d.ExternalId,
                d.Name,
                IsActive = d.IsActive && d.Controller.IsActive,
                ControllerExternalId = d.Controller.ExternalId
            })
            .FirstOrDefaultAsync(cancellationToken);

        return door is null ? null : new EquipmentResolutionResult
        {
            IsFound              = true,
            IsActive             = door.IsActive,
            EquipmentKind        = EquipmentKind.Door,
            EquipmentExternalId  = door.ExternalId,
            EquipmentName        = door.Name,
            ControllerExternalId = door.ControllerExternalId
        };
    }

    private async Task<EquipmentResolutionResult?> TryResolveDoorIoAsync(
        string ioExternalId,
        CancellationToken cancellationToken)
    {
        var doorIo = await _dbContext.DoorIos
            .AsNoTracking()
            .Where(io => io.ExternalId == ioExternalId)
            .Select(io => new
            {
                io.ExternalId,
                io.Name,
                IsActive = io.IsActive && io.Door.IsActive && io.Controller.IsActive,
                ControllerExternalId = io.Controller.ExternalId
            })
            .FirstOrDefaultAsync(cancellationToken);

        return doorIo is null ? null : new EquipmentResolutionResult
        {
            IsFound = true,
            IsActive = doorIo.IsActive,
            EquipmentKind = EquipmentKind.DoorIo,
            EquipmentExternalId = doorIo.ExternalId,
            EquipmentName = doorIo.Name,
            ControllerExternalId = doorIo.ControllerExternalId
        };
    }

    private async Task<EquipmentResolutionResult?> TryResolveExtensionIoAsync(
        string ioExternalId,
        CancellationToken cancellationToken)
    {
        var extensionIo = await _dbContext.ExtensionIos
            .AsNoTracking()
            .Where(io => io.ExternalId == ioExternalId)
            .Select(io => new
            {
                io.ExternalId,
                io.Name,
                IsActive = io.IsActive && io.Extension.IsActive && io.Controller.IsActive,
                ControllerExternalId = io.Controller.ExternalId
            })
            .FirstOrDefaultAsync(cancellationToken);

        return extensionIo is null ? null : new EquipmentResolutionResult
        {
            IsFound = true,
            IsActive = extensionIo.IsActive,
            EquipmentKind = EquipmentKind.ExtensionIo,
            EquipmentExternalId = extensionIo.ExternalId,
            EquipmentName = extensionIo.Name,
            ControllerExternalId = extensionIo.ControllerExternalId
        };
    }

    private async Task<EquipmentResolutionResult?> TryResolveControllerAsync(
        string controllerExternalId,
        CancellationToken cancellationToken)
    {
        var controller = await _dbContext.Controllers
            .AsNoTracking()
            .Where(c => c.ExternalId == controllerExternalId)
            .Select(c => new { c.ExternalId, c.Name, c.IsActive })
            .FirstOrDefaultAsync(cancellationToken);

        return controller is null ? null : new EquipmentResolutionResult
        {
            IsFound = true,
            IsActive = controller.IsActive,
            EquipmentKind = EquipmentKind.Controller,
            EquipmentExternalId = controller.ExternalId,
            EquipmentName = controller.Name,
            ControllerExternalId = controller.ExternalId
        };
    }
}
