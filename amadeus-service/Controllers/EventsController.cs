using Amadeus8.Data;
using Amadeus8.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly AmadeusDbContext _dbContext;

    public EventsController(AmadeusDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("recent")]
    public async Task<IActionResult> Recent(
        [FromQuery] int count = 50,
        CancellationToken cancellationToken = default)
    {
        if (count is < 1 or > 500)
        {
            return BadRequest(new { error = "Count must be between 1 and 500" });
        }

        var events = await _dbContext.EventLogs
            .OrderByDescending(e => e.ReceivedUtc)
            .Take(count)
            .Select(e => new EventLogDto
            {
                Id = e.Id,
                EventType = e.EventType,
                EventCategory = e.EventCategory,
                SourceEventUtc = e.SourceEventUtc,
                ReceivedUtc = e.ReceivedUtc,
                ControllerExternalId = e.ControllerExternalId,
                ObjectExternalId = e.ObjectExternalId,
                ProcessingStatus = e.ProcessingStatus
            })
            .ToListAsync(cancellationToken);

        return Ok(events);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id, CancellationToken cancellationToken)
    {
        var eventLog = await _dbContext.EventLogs
            .Where(e => e.Id == id)
            .Select(e => new EventLogDto
            {
                Id = e.Id,
                EventType = e.EventType,
                EventCategory = e.EventCategory,
                SourceEventUtc = e.SourceEventUtc,
                ReceivedUtc = e.ReceivedUtc,
                ControllerExternalId = e.ControllerExternalId,
                ObjectExternalId = e.ObjectExternalId,
                ProcessingStatus = e.ProcessingStatus
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (eventLog is null)
        {
            return NotFound();
        }

        return Ok(eventLog);
    }
}
