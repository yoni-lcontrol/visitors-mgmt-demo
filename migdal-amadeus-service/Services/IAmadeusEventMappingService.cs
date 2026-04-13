using Amadeus8.DTOs;
using Amadeus8.Models;

namespace Amadeus8.Services;

public interface IAmadeusEventMappingService
{
    IReadOnlyList<BackendAmadeusEventDto> Map(
        AmadeusEventContext context,
        EquipmentResolutionResult resolution,
        string rawPayloadJson,
        DateTime receivedUtc);
}
