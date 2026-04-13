using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IImportBridgeService
{
    /// <summary>
    /// Runs a full device import from Amadeus OData and returns the full topology.
    /// </summary>
    Task<ImportCallbackPayload> ImportDevicesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Runs an access-level import from Amadeus OData and returns the results.
    /// </summary>
    Task<AccessLevelCallbackPayload> ImportAccessLevelsAsync(CancellationToken cancellationToken);
}
