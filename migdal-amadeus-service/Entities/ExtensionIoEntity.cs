namespace Amadeus8.Entities;

public class ExtensionIoEntity
{
    public int Id { get; set; }

    public string ExternalId { get; set; } = string.Empty;

    public int ExtensionId { get; set; }

    public int ControllerId { get; set; }

    public string IoType { get; set; } = string.Empty;

    public string Direction { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedUtc { get; set; }

    public DateTime UpdatedUtc { get; set; }

    public ExtensionEntity Extension { get; set; } = null!;

    public ControllerEntity Controller { get; set; } = null!;
}
