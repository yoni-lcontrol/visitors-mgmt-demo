using Amadeus8.DTOs;
using Amadeus8.Models;

namespace Amadeus8.Services;

public sealed class AmadeusEventMappingService : IAmadeusEventMappingService
{
    public IReadOnlyList<BackendAmadeusEventDto> Map(
        AmadeusEventContext context,
        EquipmentResolutionResult resolution,
        string rawPayloadJson,
        DateTime receivedUtc)
    {
        var occurredUtc = context.EventDateTime.HasValue
            ? DateTime.SpecifyKind(context.EventDateTime.Value, DateTimeKind.Utc)
            : receivedUtc;

        var externalEventId = context.EventUid
            ?? (context.LogId.HasValue ? context.LogId.Value.ToString() : null);

        var baseEvent = new BackendAmadeusEventDto
        {
            SignalRMethod = context.SignalRMethodName,
            OccurredUtc = occurredUtc,
            ReceivedUtc = receivedUtc,
            ExternalEventId = externalEventId,
            EventUid = context.EventUid,
            LogId = context.LogId,
            EventTypeCode = context.EventTypeCode,
            ControllerExternalId = resolution.ControllerExternalId,
            ObjectExternalId = resolution.EquipmentExternalId
                ?? context.ReaderUid
                ?? context.InputUid
                ?? context.OutputUid,
            EquipmentKind = resolution.EquipmentKind.ToString(),
            EquipmentName = resolution.EquipmentName,
            ReaderUid = context.ReaderUid,
            InputUid = context.InputUid,
            OutputUid = context.OutputUid,
            CardholderUid = context.CardholderUid,
            CardCode = context.CardCode,
            CarRegistrationNum = context.CarRegistrationNum,
            AccessDeniedCode = context.AccessDeniedCode,
            RawPayloadJson = rawPayloadJson
        };

        return context.SignalRMethodName switch
        {
            "AccessEventArrived" => MapAccessEvent(baseEvent, context),
            "CommEventArrived" => MapCommEvent(baseEvent, context),
            "TechnicalEventArrived" => MapTechnicalEvent(baseEvent, context),
            "AlarmEventArrived" => MapAlarmEvent(baseEvent, context),
            "IOEventArrived" => MapIoEvent(baseEvent, context),
            _ => [With(baseEvent, "Amadeus.Generic", true)]
        };
    }

    private static IReadOnlyList<BackendAmadeusEventDto> MapAccessEvent(
        BackendAmadeusEventDto baseEvent,
        AmadeusEventContext context)
    {
        // Legacy behavior used pulse-style active->inactive notifications for access decisions.
        if (context.EventTypeCode == 1)
        {
            return
            [
                With(baseEvent, "Door.LegalCard", true),
                With(baseEvent, "Door.LegalCard", false)
            ];
        }

        var deniedType = context.AccessDeniedCode switch
        {
            1 => "Door.AntiPassbackViolation",
            2 => "Door.InvalidAccessLevel",
            3 => "Door.AccessDeniedPermanentLocked",
            _ => "Door.IllegalCard"
        };

        return
        [
            With(baseEvent, deniedType, true),
            With(baseEvent, deniedType, false)
        ];
    }

    private static IReadOnlyList<BackendAmadeusEventDto> MapCommEvent(
        BackendAmadeusEventDto baseEvent,
        AmadeusEventContext context)
    {
        return context.EventTypeCode switch
        {
            0 => [With(baseEvent, "Communication.Lost", true)],
            1 => [With(baseEvent, "Communication.Lost", false)],
            2 or 3 => [With(baseEvent, "Door.DoorCommunication", true)],
            4 or 5 => [With(baseEvent, "Door.DoorCommunication", false)],
            _ => [With(baseEvent, "Communication.Generic", true)]
        };
    }

    private static IReadOnlyList<BackendAmadeusEventDto> MapTechnicalEvent(
        BackendAmadeusEventDto baseEvent,
        AmadeusEventContext context)
    {
        return context.EventTypeCode switch
        {
            0 => [With(baseEvent, "Controller.PowerFailure", true)],
            1 or 2 => [With(baseEvent, "Controller.PowerFailure", false)],
            3 => [With(baseEvent, "Controller.BatteryFailure", true)],
            4 => [With(baseEvent, "Controller.BatteryFailure", false)],
            _ => [With(baseEvent, "Controller.Technical", true)]
        };
    }

    private static IReadOnlyList<BackendAmadeusEventDto> MapAlarmEvent(
        BackendAmadeusEventDto baseEvent,
        AmadeusEventContext context)
    {
        return context.EventTypeCode switch
        {
            0 => [With(baseEvent, "Door.ForceOpened", true)],
            1 => [With(baseEvent, "Door.DoorHeldOpen", true)],
            2 or 3 => [With(baseEvent, "Door.DoorAlarm", false)],
            _ => [With(baseEvent, "Door.DoorAlarm", true)]
        };
    }

    private static IReadOnlyList<BackendAmadeusEventDto> MapIoEvent(
        BackendAmadeusEventDto baseEvent,
        AmadeusEventContext context)
    {
        if (context.InputStatusCode.HasValue)
        {
            var inputType = context.InputStatusCode.Value switch
            {
                0 => "IO.IOOpen",
                1 => "IO.IOClosed",
                2 or 3 => "IO.Fault",
                _ => "IO.InputChanged"
            };

            return [With(baseEvent, inputType, true)];
        }

        if (context.OutputStatusCode.HasValue)
        {
            var outputType = context.OutputStatusCode.Value switch
            {
                0 => "IO.IOOpen",
                1 => "Door.PermanentUnlocked",
                2 => "IO.IOClosed",
                3 => "Door.PermanentLocked",
                _ => "IO.OutputChanged"
            };

            return [With(baseEvent, outputType, true)];
        }

        return [With(baseEvent, "IO.Changed", true)];
    }

    private static BackendAmadeusEventDto With(
        BackendAmadeusEventDto source,
        string eventType,
        bool isActive)
    {
        return new BackendAmadeusEventDto
        {
            SourceSystem = source.SourceSystem,
            SignalRMethod = source.SignalRMethod,
            InternalEventType = eventType,
            IsActive = isActive,
            OccurredUtc = source.OccurredUtc,
            ReceivedUtc = source.ReceivedUtc,
            ExternalEventId = source.ExternalEventId,
            EventUid = source.EventUid,
            LogId = source.LogId,
            EventTypeCode = source.EventTypeCode,
            ControllerExternalId = source.ControllerExternalId,
            ObjectExternalId = source.ObjectExternalId,
            EquipmentKind = source.EquipmentKind,
            EquipmentName = source.EquipmentName,
            ReaderUid = source.ReaderUid,
            InputUid = source.InputUid,
            OutputUid = source.OutputUid,
            CardholderUid = source.CardholderUid,
            CardCode = source.CardCode,
            CarRegistrationNum = source.CarRegistrationNum,
            AccessDeniedCode = source.AccessDeniedCode,
            RawPayloadJson = source.RawPayloadJson
        };
    }
}
