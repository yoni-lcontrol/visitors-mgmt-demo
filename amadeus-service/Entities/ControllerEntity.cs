namespace Amadeus8.Entities;

public class ControllerEntity
{
    public int Id { get; set; }

    public string ExternalId { get; set; } = string.Empty;

    public string? ExternalApiKey { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? SiteExternalId { get; set; }

    public bool IsActive { get; set; } = true;

    public string? LastCommunicationStatus { get; set; }

    public DateTime CreatedUtc { get; set; }

    public DateTime UpdatedUtc { get; set; }

    public ICollection<DoorEntity> Doors { get; set; } = [];

    public ICollection<ExtensionEntity> Extensions { get; set; } = [];
}
