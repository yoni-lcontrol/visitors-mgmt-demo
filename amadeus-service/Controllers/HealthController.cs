using Microsoft.AspNetCore.Mvc;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new { status = "Healthy", timestamp = DateTime.UtcNow });
    }

    [HttpGet("live")]
    public IActionResult Live()
    {
        return Ok(new { status = "Alive" });
    }

    [HttpGet("ready")]
    public IActionResult Ready()
    {
        // Could add deeper checks here (DB, Amadeus connectivity)
        return Ok(new { status = "Ready" });
    }
}
