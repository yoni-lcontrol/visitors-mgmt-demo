using Amadeus8.DTOs;
using Amadeus8.Data;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CardholdersController : ControllerBase
{
    private readonly ICardholderCommandService _commandService;
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<CardholdersController> _logger;

    public CardholdersController(
        ICardholderCommandService commandService,
        AmadeusDbContext dbContext,
        ILogger<CardholdersController> logger)
    {
        _commandService = commandService;
        _dbContext = dbContext;
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

    [HttpPost("visitors")]
    public async Task<IActionResult> CreateVisitor([FromBody] CreateAmadeusVisitorDto dto, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Creating visitor via API");
        var result = await _commandService.CreateVisitorAsync(dto, cancellationToken);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return CreatedAtAction(nameof(GetByUid), new { amadeusUid = result.AmadeusExternalId }, result);
    }

    [HttpDelete("visitors/{amadeusUid}")]
    public async Task<IActionResult> DeleteVisitor(string amadeusUid, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Deleting visitor {Uid} via API", amadeusUid);
        var result = await _commandService.DeleteVisitorAsync(amadeusUid, cancellationToken);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpGet("{amadeusUid}/cards")]
    public async Task<IActionResult> GetCardsByCardholder(string amadeusUid, CancellationToken cancellationToken)
    {
        var cards = await _dbContext.Cards
            .AsNoTracking()
            .Where(c => c.CardholderUid == amadeusUid && !c.IsDeleted)
            .Select(c => new
            {
                c.AmadeusUid,
                c.CardNumber,
                c.CardholderUid,
                c.CardholderIdNumber,
                c.Status,
                c.FromDateValidUtc,
                c.ToDateValidUtc,
                c.IsFromDateActive,
                c.IsToDateActive,
            })
            .ToListAsync(cancellationToken);

        return Ok(cards);
    }

    [HttpGet("cards")]
    public async Task<IActionResult> GetAllCards([FromQuery] string? cardholderIdNumber, CancellationToken cancellationToken)
    {
        var query = _dbContext.Cards.AsNoTracking().Where(c => !c.IsDeleted);

        if (!string.IsNullOrWhiteSpace(cardholderIdNumber))
        {
            query = query.Where(c => c.CardholderIdNumber == cardholderIdNumber);
        }

        var cards = await query
            .Select(c => new
            {
                c.AmadeusUid,
                c.CardNumber,
                c.CardholderUid,
                c.CardholderIdNumber,
                c.Status,
                c.FromDateValidUtc,
                c.ToDateValidUtc,
                c.IsFromDateActive,
                c.IsToDateActive,
            })
            .ToListAsync(cancellationToken);

        return Ok(cards);
    }

    /// <summary>
    /// Returns cardholders with their linked badge (card) info.
    /// </summary>
    [HttpGet("with-badges")]
    public async Task<IActionResult> GetCardholdersWithBadges(CancellationToken cancellationToken)
    {
        var cardholders = await _dbContext.Cardholders
            .AsNoTracking()
            .Where(c => !c.IsDeleted && !c.IsArchived)
            .ToListAsync(cancellationToken);

        var cards = await _dbContext.Cards
            .AsNoTracking()
            .Where(c => !c.IsDeleted)
            .ToListAsync(cancellationToken);

        var cardsByCardholder = cards
            .Where(c => c.CardholderUid != null)
            .GroupBy(c => c.CardholderUid!)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = cardholders.Select(ch =>
        {
            var badge = cardsByCardholder.GetValueOrDefault(ch.AmadeusUid)?.FirstOrDefault();
            return new
            {
                ch.AmadeusUid,
                ch.CardholderIdNumber,
                ch.FirstName,
                ch.LastName,
                ch.Status,
                BadgeCode = badge?.CardNumber,
                BadgeStatus = badge?.Status,
                BadgeAmadeusUid = badge?.AmadeusUid,
            };
        }).ToList();

        return Ok(result);
    }

    [HttpPatch("cards/{amadeusUid}/badge-code")]
    public async Task<IActionResult> SetBadgeCode(string amadeusUid, [FromBody] SetBadgeCodeDto dto, CancellationToken cancellationToken)
    {
        var card = await _dbContext.Cards.FirstOrDefaultAsync(c => c.AmadeusUid == amadeusUid, cancellationToken);
        if (card is null) return NotFound();

        card.CardNumber = dto.BadgeCode;
        card.UpdatedUtc = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { card.AmadeusUid, card.CardNumber, card.CardholderIdNumber });
    }
}

public record SetBadgeCodeDto(string BadgeCode);
