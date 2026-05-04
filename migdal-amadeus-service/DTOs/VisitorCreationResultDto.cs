namespace Amadeus8.DTOs;

public class VisitorCreationResultDto
{
    public bool Success { get; set; }
    public string? AmadeusExternalId { get; set; }
    public string SyncStatus { get; set; } = string.Empty;
    public DateTime? LastSyncedAtUtc { get; set; }
    public string? ErrorMessage { get; set; }
    public bool IsRetryable { get; set; }
}
