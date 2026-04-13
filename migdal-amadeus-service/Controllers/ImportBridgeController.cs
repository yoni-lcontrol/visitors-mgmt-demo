using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/import")]
public class ImportBridgeController : ControllerBase
{
    private readonly IImportBridgeService _importBridgeService;
    private readonly ILogger<ImportBridgeController> _logger;

    public ImportBridgeController(
        IImportBridgeService importBridgeService,
        ILogger<ImportBridgeController> logger)
    {
        _importBridgeService = importBridgeService;
        _logger = logger;
    }

    /// <summary>
    /// Imports controllers/doors/extensions from Amadeus OData and returns the full topology.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> ImportDevices(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Device import request received");

        var payload = await _importBridgeService.ImportDevicesAsync(cancellationToken);

        _logger.LogInformation("Device import completed with {Count} controllers", payload.Controllers.Count);

        return Ok(payload);
    }

    /// <summary>
    /// Imports access levels from Amadeus OData and returns them.
    /// </summary>
    [HttpPost("access-levels")]
    public async Task<IActionResult> ImportAccessLevels(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Access-level import request received");

        var payload = await _importBridgeService.ImportAccessLevelsAsync(cancellationToken);

        _logger.LogInformation("Access-level import completed with {Count} items", payload.AccessLevels.Count);

        return Ok(payload);
    }
}
