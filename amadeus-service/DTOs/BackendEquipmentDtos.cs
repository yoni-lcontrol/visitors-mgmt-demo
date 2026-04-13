namespace Amadeus8.DTOs;

public class BackendControllerDto
{
    public string? Id { get; set; }
    public string? ExternalId { get; set; }
    public string? AmadeusUid { get; set; }
    public string? Name { get; set; }
    public bool? IsActive { get; set; }
}

public class BackendDoorDto
{
    public string? Id { get; set; }
    public string? ExternalId { get; set; }
    public string? AmadeusUid { get; set; }
    public string? Name { get; set; }
    public string? ControllerExternalId { get; set; }
}

public class BackendDoorIoDto
{
    public string? Id { get; set; }
    public string? ExternalId { get; set; }
    public string? AmadeusUid { get; set; }
    public string? Name { get; set; }
    public string? IoType { get; set; }
    public string? Direction { get; set; }
    public string? ControllerExternalId { get; set; }
}

public class BackendExtensionDto
{
    public string? Id { get; set; }
    public string? ExternalId { get; set; }
    public string? AmadeusUid { get; set; }
    public string? Name { get; set; }
    public string? ControllerExternalId { get; set; }
}

public class BackendExtensionIoDto
{
    public string? Id { get; set; }
    public string? ExternalId { get; set; }
    public string? AmadeusUid { get; set; }
    public string? Name { get; set; }
    public string? IoType { get; set; }
    public string? Direction { get; set; }
    public string? ExtensionExternalId { get; set; }
    public string? ControllerExternalId { get; set; }
}