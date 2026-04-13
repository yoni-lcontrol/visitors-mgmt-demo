namespace Amadeus8.Entities;

public class DoorEntity
{
    public int Id { get; set; }

    public string ExternalId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int ControllerId { get; set; }

    public string? ReaderExternalId { get; set; }

    public string? PrimaryOutputExternalId { get; set; }

    public string? DoorContactInputExternalId { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedUtc { get; set; }

    public DateTime UpdatedUtc { get; set; }

    public ControllerEntity Controller { get; set; } = null!;

    public ICollection<DoorIoEntity> DoorIos { get; set; } = [];
}
