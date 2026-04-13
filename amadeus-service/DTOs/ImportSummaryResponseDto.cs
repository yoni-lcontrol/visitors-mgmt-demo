namespace Amadeus8.DTOs;

public class ImportSummaryResponseDto
{
    public bool Success { get; set; }

    public string ImportType { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    public string Operation { get; set; } = string.Empty;

    public int TotalReceived { get; set; }

    public int Created { get; set; }

    public int Updated { get; set; }

    public int Skipped { get; set; }

    public int Failed { get; set; }

    public DateTime StartedUtc { get; set; }

    public DateTime? CompletedUtc { get; set; }
}
