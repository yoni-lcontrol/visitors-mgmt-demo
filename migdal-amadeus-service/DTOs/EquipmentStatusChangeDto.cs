namespace Amadeus8.DTOs;

public class EquipmentStatusChangeDto
{
    public string ExternalId { get; set; } = string.Empty;
    public string EquipmentType { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class EquipmentStatusChangeResultDto
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string EquipmentType { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
