namespace Amadeus8.Entities;

public class CardEntity
{
    public int Id { get; set; }

    public string AmadeusUid { get; set; } = string.Empty;

    public string? CardholderUid { get; set; }

    public string? CardholderIdNumber { get; set; }

    public string? CardNumber { get; set; }

    public string? Status { get; set; }

    public DateTime? FromDateValidUtc { get; set; }

    public DateTime? ToDateValidUtc { get; set; }

    public bool IsFromDateActive { get; set; }

    public bool IsToDateActive { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime CreatedUtc { get; set; }

    public DateTime UpdatedUtc { get; set; }
}
