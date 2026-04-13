namespace Amadeus8.DTOs;

public class SyncStatusDto
{
    public DateTime? LastSyncStartUtc { get; set; }
    public DateTime? LastSyncEndUtc { get; set; }
    public DateTime? LastSuccessfulSyncUtc { get; set; }
    public string CurrentState { get; set; } = "Unknown";
    public string? LastErrorSummary { get; set; }
}
