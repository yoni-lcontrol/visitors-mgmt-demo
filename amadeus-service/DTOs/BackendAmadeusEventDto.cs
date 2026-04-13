namespace Amadeus8.DTOs;

public sealed class BackendAmadeusEventDto
{
    public string SourceSystem { get; set; } = "Amadeus8";

    public string SignalRMethod { get; set; } = string.Empty;

    public string InternalEventType { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public DateTime OccurredUtc { get; set; }

    public DateTime ReceivedUtc { get; set; }

    public string? ExternalEventId { get; set; }

    public string? EventUid { get; set; }

    public long? LogId { get; set; }

    public int? EventTypeCode { get; set; }

    public string? ControllerExternalId { get; set; }

    public string? ObjectExternalId { get; set; }

    public string? EquipmentKind { get; set; }

    public string? EquipmentName { get; set; }

    public string? ReaderUid { get; set; }

    public string? InputUid { get; set; }

    public string? OutputUid { get; set; }

    public string? CardholderUid { get; set; }

    public string? CardCode { get; set; }

    public string? CarRegistrationNum { get; set; }

    public int? AccessDeniedCode { get; set; }

    public string RawPayloadJson { get; set; } = string.Empty;
}
