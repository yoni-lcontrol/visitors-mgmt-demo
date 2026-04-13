namespace Amadeus8.Entities;

public class EventLogEntity
{
    public long Id { get; set; }

    public string SourceSystem { get; set; } = "Amadeus8";

    public string? ExternalEventId { get; set; }

    public string EventType { get; set; } = string.Empty;

    public string? EventCategory { get; set; }

    public DateTime? SourceEventUtc { get; set; }

    public DateTime ReceivedUtc { get; set; }

    public string? ControllerExternalId { get; set; }

    public string? ObjectExternalId { get; set; }

    public string? RawPayloadJson { get; set; }

    public string ProcessingStatus { get; set; } = "Received";

    public string? ProcessingError { get; set; }
}
