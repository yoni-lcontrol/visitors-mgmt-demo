namespace Amadeus8.DTOs;

public class ListenerStatusDto
{
    public bool IsConnected { get; set; }
    public DateTime? LastConnectedUtc { get; set; }
    public DateTime? LastEventReceivedUtc { get; set; }
    public string CurrentState { get; set; } = "Unknown";
    public string? LastErrorSummary { get; set; }
}
