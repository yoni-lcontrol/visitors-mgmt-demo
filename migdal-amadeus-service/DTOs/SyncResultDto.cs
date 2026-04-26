namespace Amadeus8.DTOs;

public class SyncResultDto
{
    public bool Success { get; set; }
    public string Operation { get; set; } = string.Empty;
    public DateTime StartedUtc { get; set; }
    public DateTime? CompletedUtc { get; set; }
    public int TotalReceived { get; set; }
    public int Created { get; set; }
    public int Updated { get; set; }
    public int Unchanged { get; set; }
    public int Succeeded { get; set; }
    public int Skipped { get; set; }
    public int Failed { get; set; }
    public string? ErrorMessage { get; set; }
    public List<ImportFailureDetailDto> Failures { get; set; } = [];
}
