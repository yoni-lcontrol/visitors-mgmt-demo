namespace Amadeus8.DTOs;

public class ImportFailureDetailDto
{
    public DateTime OccurredUtc { get; set; } = DateTime.UtcNow;
    public string EquipmentType { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public string? Name { get; set; }
    public string FailureStage { get; set; } = string.Empty;
    public string FailureCategory { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? StackTrace { get; set; }
}
