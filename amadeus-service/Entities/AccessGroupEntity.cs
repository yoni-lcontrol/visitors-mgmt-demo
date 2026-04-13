namespace Amadeus8.Entities;

public class AccessGroupEntity
{
    public int Id { get; set; }

    public string AmadeusUid { get; set; } = string.Empty;

    public string? ApiKey { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedUtc { get; set; }

    public DateTime UpdatedUtc { get; set; }
}
