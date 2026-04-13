using Amadeus8.DTOs;

namespace Amadeus8.Services;

public class BackendEquipmentSnapshot
{
    public DateTime LoadedUtc { get; init; }
    public IReadOnlyDictionary<string, BackendControllerDto> ControllersByExternalId { get; init; } = new Dictionary<string, BackendControllerDto>();
    public IReadOnlyDictionary<string, BackendDoorDto> DoorsByExternalId { get; init; } = new Dictionary<string, BackendDoorDto>();
    public IReadOnlyDictionary<string, BackendDoorIoDto> DoorIosByExternalId { get; init; } = new Dictionary<string, BackendDoorIoDto>();
    public IReadOnlyDictionary<string, BackendExtensionDto> ExtensionsByExternalId { get; init; } = new Dictionary<string, BackendExtensionDto>();
    public IReadOnlyDictionary<string, BackendExtensionIoDto> ExtensionIosByExternalId { get; init; } = new Dictionary<string, BackendExtensionIoDto>();
}