using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/equipment-status")]
public class EquipmentStatusController : ControllerBase
{
    private readonly IEquipmentStatusService _statusService;
    private readonly ILogger<EquipmentStatusController> _logger;

    public EquipmentStatusController(
        IEquipmentStatusService statusService,
        ILogger<EquipmentStatusController> logger)
    {
        _statusService = statusService;
        _logger = logger;
    }

    [HttpPut]
    public async Task<IActionResult> ChangeStatus(
        [FromBody] EquipmentStatusChangeDto request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ExternalId))
        {
            return BadRequest(new { error = "ExternalId is required" });
        }

        if (string.IsNullOrWhiteSpace(request.EquipmentType))
        {
            return BadRequest(new { error = "EquipmentType is required" });
        }

        var result = await _statusService.ChangeStatusAsync(request, cancellationToken);

        if (!result.Success)
        {
            _logger.LogWarning(
                "Status change failed. EquipmentType={EquipmentType}, ExternalId={ExternalId}, Error={Error}",
                request.EquipmentType, request.ExternalId, result.ErrorMessage);

            return NotFound(result);
        }

        return Ok(result);
    }
}
