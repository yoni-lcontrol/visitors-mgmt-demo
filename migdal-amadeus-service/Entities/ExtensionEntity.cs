namespace Amadeus8.Entities;

public class ExtensionEntity
{
    public int Id { get; set; }

    public string ExternalId { get; set; } = string.Empty;

    public int ControllerId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? ModuleType { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedUtc { get; set; }

    public DateTime UpdatedUtc { get; set; }

    public ControllerEntity Controller { get; set; } = null!;

    public ICollection<ExtensionIoEntity> ExtensionIos { get; set; } = [];
}
