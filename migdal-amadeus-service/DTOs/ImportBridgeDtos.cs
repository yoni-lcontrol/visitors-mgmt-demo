namespace Amadeus8.DTOs;

/// <summary>
/// Response payload containing the full device topology imported from Amadeus.
/// </summary>
public class ImportCallbackPayload
{
    public List<CallbackController> Controllers { get; set; } = [];
}

public class CallbackController
{
    public string Name { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public List<CallbackDoor> Doors { get; set; } = [];
    public List<CallbackExtension> Extensions { get; set; } = [];
}

public class CallbackDoor
{
    public string Name { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public List<CallbackIo> DoorIos { get; set; } = [];
}

public class CallbackExtension
{
    public string Name { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public List<CallbackIo> ExtensionIos { get; set; } = [];
}

public class CallbackIo
{
    public string Name { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public string? Type { get; set; }
}

/// <summary>
/// Payload POSTed back to the NestJS access-levels callback URL.
/// Shape matches the backend's <c>AccessLevelCallbackPayload</c> interface.
/// </summary>
public class AccessLevelCallbackPayload
{
    public List<CallbackAccessLevel> AccessLevels { get; set; } = [];
}

public class CallbackAccessLevel
{
    public string Name { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public bool VisitorAccess { get; set; }
}
