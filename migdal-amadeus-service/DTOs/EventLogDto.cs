namespace Amadeus8.DTOs;

public class EventLogDto
{
    public long Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string? EventCategory { get; set; }
    public DateTime? SourceEventUtc { get; set; }
    public DateTime ReceivedUtc { get; set; }
    public string? ControllerExternalId { get; set; }
    public string? ObjectExternalId { get; set; }
    public string ProcessingStatus { get; set; } = string.Empty;
}
