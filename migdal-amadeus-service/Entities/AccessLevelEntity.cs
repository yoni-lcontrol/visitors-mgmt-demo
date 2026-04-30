namespace Amadeus8.Entities;

public class AccessLevelEntity
{
    public int Id { get; set; }

    // Stable identifier from Amadeus for the source group object.
    public string AmadeusUid { get; set; } = string.Empty;

    // Source type: AccessGroup or SecurityGroup.
    public string SourceType { get; set; } = string.Empty;

    public string? ApiKey { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? ExternalId { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedUtc { get; set; }

    public DateTime UpdatedUtc { get; set; }
}
