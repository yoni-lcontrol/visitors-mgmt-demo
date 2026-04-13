using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CardholdersController : ControllerBase
{
    private readonly ICardholderCommandService _commandService;
    private readonly ILogger<CardholdersController> _logger;

    public CardholdersController(
        ICardholderCommandService commandService,
        ILogger<CardholdersController> logger)
    {
        _commandService = commandService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var cardholders = await _commandService.GetCardholdersAsync(cancellationToken);
        return Ok(cardholders);
    }

    [HttpGet("{amadeusUid}")]
    public async Task<IActionResult> GetByUid(string amadeusUid, CancellationToken cancellationToken)
    {
        var cardholder = await _commandService.GetCardholderByUidAsync(amadeusUid, cancellationToken);
        if (cardholder is null)
        {
            return NotFound();
        }
        return Ok(cardholder);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CardholderCreateDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Creating cardholder via API");
        try
        {
            var created = await _commandService.CreateCardholderAsync(dto, cancellationToken);
            return CreatedAtAction(nameof(GetByUid), new { amadeusUid = created.AmadeusUid }, created);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to create cardholder in Amadeus");
            return StatusCode(502, new { error = "Failed to create cardholder in Amadeus", detail = ex.Message });
        }
    }

    [HttpPatch("{amadeusUid}")]
    public async Task<IActionResult> Update(string amadeusUid, [FromBody] CardholderUpdateDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Updating cardholder {Uid} via API", amadeusUid);
        try
        {
            await _commandService.UpdateCardholderAsync(amadeusUid, dto, cancellationToken);
            return NoContent();
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to update cardholder {Uid} in Amadeus", amadeusUid);
            return StatusCode(502, new { error = "Failed to update cardholder in Amadeus", detail = ex.Message });
        }
    }

    [HttpDelete("{amadeusUid}")]
    public async Task<IActionResult> Delete(string amadeusUid, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Deleting cardholder {Uid} via API", amadeusUid);
        try
        {
            await _commandService.DeleteCardholderAsync(amadeusUid, cancellationToken);
            return NoContent();
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to delete cardholder {Uid} in Amadeus", amadeusUid);
            return StatusCode(502, new { error = "Failed to delete cardholder in Amadeus", detail = ex.Message });
        }
    }

    [HttpPost("{amadeusUid}/archive")]
    public async Task<IActionResult> Archive(string amadeusUid, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Archiving cardholder {Uid} via API", amadeusUid);
        try
        {
            await _commandService.ArchiveCardholderAsync(amadeusUid, cancellationToken);
            return NoContent();
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to archive cardholder {Uid} in Amadeus", amadeusUid);
            return StatusCode(502, new { error = "Failed to archive cardholder in Amadeus", detail = ex.Message });
        }
    }
}
