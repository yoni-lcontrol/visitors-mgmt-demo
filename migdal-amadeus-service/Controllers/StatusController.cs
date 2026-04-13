using Amadeus8.HostedServices;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatusController : ControllerBase
{
    private readonly IAmadeusSignalRClient _signalRClient;
    private readonly AmadeusFullSyncHostedService _syncService;

    public StatusController(
        IAmadeusSignalRClient signalRClient,
        AmadeusFullSyncHostedService syncService)
    {
        _signalRClient = signalRClient;
        _syncService = syncService;
    }

    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            listener = _signalRClient.GetStatus(),
            sync = _syncService.GetStatus(),
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("listener")]
    public IActionResult Listener()
    {
        return Ok(_signalRClient.GetStatus());
    }

    [HttpGet("sync")]
    public IActionResult Sync()
    {
        return Ok(_syncService.GetStatus());
    }
}
