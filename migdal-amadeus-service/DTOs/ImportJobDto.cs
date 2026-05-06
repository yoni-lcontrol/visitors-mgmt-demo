namespace Amadeus8.DTOs;

public class ImportJobDto
{
    public string JobId { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string? Phase { get; set; }
    public int? Processed { get; set; }
    public int? Total { get; set; }
    public string? ErrorMessage { get; set; }
    public ImportCallbackPayload? Payload { get; set; }
    public DateTime StartedUtc { get; set; }
    public DateTime? CompletedUtc { get; set; }
}
