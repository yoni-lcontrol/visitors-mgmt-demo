using Amadeus8.Data;
using Amadeus8.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SecurityGroupsController : ControllerBase
{
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<SecurityGroupsController> _logger;

    public SecurityGroupsController(
        AmadeusDbContext dbContext,
        ILogger<SecurityGroupsController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var groups = await _dbContext.SecurityGroups
            .AsNoTracking()
            .Where(g => g.IsActive)
            .OrderBy(g => g.Name)
            .Select(g => new SecurityGroupDto
            {
                Id = g.Id,
                AmadeusUid = g.AmadeusUid,
                ApiKey = g.ApiKey,
                Name = g.Name,
                Description = g.Description,
                IsActive = g.IsActive
            })
            .ToListAsync(cancellationToken);

        return Ok(groups);
    }

    [HttpGet("{amadeusUid}")]
    public async Task<IActionResult> GetByUid(string amadeusUid, CancellationToken cancellationToken)
    {
        var group = await _dbContext.SecurityGroups
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.AmadeusUid == amadeusUid, cancellationToken);

        if (group is null)
        {
            return NotFound();
        }

        return Ok(new SecurityGroupDto
        {
            Id = group.Id,
            AmadeusUid = group.AmadeusUid,
            ApiKey = group.ApiKey,
            Name = group.Name,
            Description = group.Description,
            IsActive = group.IsActive
        });
    }
}
