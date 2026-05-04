using Amadeus8.Data;
using Amadeus8.Entities;
using Amadeus8.Models;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Services;

/// <summary>
/// Processing pipeline for raw Amadeus SignalR events.
///
/// Flow:
///   1. Parse raw JSON into a typed <see cref="AmadeusEventContext"/>.
///   2. Deduplicate against previously stored events.
///   3. Resolve the physical equipment via <see cref="IEquipmentResolverService"/>.
///   4. Persist the event log with a status reflecting the filter decision.
///   5. If the equipment is known and active, forward the event to the backend.
/// </summary>
public class EventProcessingService : IEventProcessingService
{
    private readonly AmadeusDbContext _dbContext;
    private readonly IEquipmentResolverService _equipmentResolver;
    private readonly IAmadeusEventMappingService _eventMapper;
    private readonly IBackendApiClient _backendApiClient;
    private readonly ILogger<EventProcessingService> _logger;

    public EventProcessingService(
        AmadeusDbContext dbContext,
        IEquipmentResolverService equipmentResolver,
        IAmadeusEventMappingService eventMapper,
        IBackendApiClient backendApiClient,
        ILogger<EventProcessingService> logger)
    {
        _dbContext = dbContext;
        _equipmentResolver = equipmentResolver;
        _eventMapper = eventMapper;
        _backendApiClient = backendApiClient;
        _logger = logger;
    }

    public async Task ProcessEventAsync(
        string rawPayloadJson,
        string signalRMethodName,
        CancellationToken cancellationToken)
    {
        _logger.LogDebug("Received Amadeus event from {Method}", signalRMethodName);

        if (string.IsNullOrWhiteSpace(rawPayloadJson))
        {
            _logger.LogWarning("Empty event payload received from {Method}, skipping", signalRMethodName);
            return;
        }

        // ── 1. Parse ─────────────────────────────────────────────────────────
        var context = AmadeusEventContext.TryParse(rawPayloadJson, signalRMethodName);
        if (context is null)
        {
            _logger.LogWarning("No data in event payload from {Method}, skipping", signalRMethodName);
            return;
        }

        // ── 2. Deduplicate ───────────────────────────────────────────────────
        // Use "uid" (event UID) as primary dedup key; fall back to "logID".
        var externalEventId = context.EventUid
            ?? (context.LogId.HasValue ? context.LogId.Value.ToString() : null);

        if (!string.IsNullOrEmpty(externalEventId))
        {
            var isDuplicate = await _dbContext.EventLogs
                .AnyAsync(e => e.ExternalEventId == externalEventId, cancellationToken);

            if (isDuplicate)
            {
                _logger.LogDebug(
                    "Duplicate event uid={Uid} from {Method}, skipping",
                    externalEventId, signalRMethodName);
                return;
            }
        }

        // ── 3. Equipment resolution & active-status filter ────────────────────
        var resolution = await _equipmentResolver.ResolveAsync(context, cancellationToken);

        if (!resolution.IsFound)
        {
            _logger.LogDebug(
                "Event {Method} uid={Uid} readerUID={ReaderUid}: " +
                "no matching equipment found in local database — skipping",
                signalRMethodName, context.EventUid ?? "N/A", context.ReaderUid ?? "(none)");
            return;
        }

        if (!resolution.IsActive)
        {
            _logger.LogDebug(
                "Event {Method} uid={Uid} readerUID={ReaderUid}: " +
                "equipment '{Equipment}' ({Kind}) is inactive — skipping",
                signalRMethodName, context.EventUid ?? "N/A", context.ReaderUid ?? "(none)",
                resolution.EquipmentName, resolution.EquipmentKind);
            return;
        }

        _logger.LogDebug(
            "Event {Method} uid={Uid} readerUID={ReaderUid}: " +
            "equipment '{Equipment}' ({Kind}) matched and active — forwarding",
            signalRMethodName, context.EventUid ?? "N/A", context.ReaderUid ?? "(none)",
            resolution.EquipmentName, resolution.EquipmentKind);

        // ── 4. Persist event log ─────────────────────────────────────────────
        DateTime? sourceEventUtc = null;
        if (context.EventDateTime.HasValue)
        {
            // Amadeus sends local time; tag it as UTC for storage consistency.
            sourceEventUtc = DateTime.SpecifyKind(context.EventDateTime.Value, DateTimeKind.Utc);
        }

        var eventLog = new EventLogEntity
        {
            SourceSystem     = "Amadeus8",
            ExternalEventId  = externalEventId,
            EventType        = context.EventTypeCode?.ToString() ?? "Unknown",
            EventCategory    = signalRMethodName,
            SourceEventUtc   = sourceEventUtc,
            ReceivedUtc      = DateTime.UtcNow,
            ControllerExternalId = resolution.ControllerExternalId,
            ObjectExternalId = resolution.EquipmentExternalId
                                ?? context.ReaderUid
                                ?? context.InputUid
                                ?? context.OutputUid,
            RawPayloadJson   = rawPayloadJson,
            ProcessingStatus = "ReadyToForward"
        };

        _dbContext.EventLogs.Add(eventLog);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // ── 5. Forward to backend ─────────────────────────────────────────────
        var normalizedEvents = _eventMapper.Map(context, resolution, rawPayloadJson, eventLog.ReceivedUtc);
        if (normalizedEvents.Count == 0)
        {
            eventLog.ProcessingStatus = "SkippedMapping";
            await _dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        try
        {
            await _backendApiClient.SendAmadeusEventsAsync(normalizedEvents, cancellationToken);

            eventLog.ProcessingStatus = "Forwarded";
            eventLog.ProcessingError = null;
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Forwarded {Count} event(s). Method={Method}, Uid={Uid}, Equipment={Equipment} ({Kind})",
                normalizedEvents.Count,
                signalRMethodName,
                context.EventUid ?? "N/A",
                resolution.EquipmentName,
                resolution.EquipmentKind);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed forwarding event(s). Method={Method}, Uid={Uid}",
                signalRMethodName,
                context.EventUid ?? "N/A");

            eventLog.ProcessingStatus = "ForwardFailed";
            eventLog.ProcessingError = ex.Message.Length > 2048 ? ex.Message[..2048] : ex.Message;

            try
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (Exception persistEx)
            {
                _logger.LogError(persistEx, "Failed to persist ForwardFailed status for event {EventLogId}", eventLog.Id);
            }
        }
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private async Task PersistFailedEventAsync(
        string rawPayload,
        string signalRMethodName,
        string status,
        string error,
        CancellationToken cancellationToken)
    {
        try
        {
            var failedLog = new EventLogEntity
            {
                SourceSystem     = "Amadeus8",
                EventType        = "Unknown",
                EventCategory    = signalRMethodName,
                ReceivedUtc      = DateTime.UtcNow,
                RawPayloadJson   = rawPayload,
                ProcessingStatus = status,
                ProcessingError  = error.Length > 2048 ? error[..2048] : error
            };
            _dbContext.EventLogs.Add(failedLog);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist failed event record for {Method}", signalRMethodName);
        }
    }
}
