using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
    private readonly IDeviceImportService _importService;
    private readonly IAccessGroupImportService _accessGroupImportService;
    private readonly ISecurityGroupImportService _securityGroupImportService;
    private readonly IAccessLevelImportService _accessLevelImportService;
    private readonly ICardholderSyncService _cardholderSyncService;
    private readonly ILogger<SyncController> _logger;

    public SyncController(
        IDeviceImportService importService,
        IAccessGroupImportService accessGroupImportService,
        ISecurityGroupImportService securityGroupImportService,
        IAccessLevelImportService accessLevelImportService,
        ICardholderSyncService cardholderSyncService,
        ILogger<SyncController> logger)
    {
        _importService = importService;
        _accessGroupImportService = accessGroupImportService;
        _securityGroupImportService = securityGroupImportService;
        _accessLevelImportService = accessLevelImportService;
        _cardholderSyncService = cardholderSyncService;
        _logger = logger;
    }

    [HttpPost("full")]
    public async Task<IActionResult> Full(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Manual full sync triggered via API");
        try
        {
            var result = await _importService.ImportAllAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual full sync failed");
            return StatusCode(500, new { error = "Sync operation failed" });
        }
    }

    [HttpPost("controllers")]
    public async Task<IActionResult> Controllers(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Manual controller sync triggered via API");
        try
        {
            var result = await _importService.ImportControllersAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual controller sync failed");
            return StatusCode(500, new { error = "Sync operation failed" });
        }
    }

    [HttpPost("doors")]
    public async Task<IActionResult> Doors(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Manual door sync triggered via API");
        try
        {
            var result = await _importService.ImportDoorsAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual door sync failed");
            return StatusCode(500, new { error = "Sync operation failed" });
        }
    }

    [HttpPost("extensions")]
    public async Task<IActionResult> Extensions(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Manual extension sync triggered via API");
        try
        {
            var result = await _importService.ImportExtensionsAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual extension sync failed");
            return StatusCode(500, new { error = "Sync operation failed" });
        }
    }

    [HttpPost("access-groups")]
    public async Task<IActionResult> AccessGroups(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Manual access group sync triggered via API");
        try
        {
            var result = await _accessGroupImportService.ImportAccessGroupsAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual access group sync failed");
            return StatusCode(500, new { error = "Sync operation failed" });
        }
    }

    [HttpPost("security-groups")]
    public async Task<IActionResult> SecurityGroups(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Manual security group sync triggered via API");
        try
        {
            var result = await _securityGroupImportService.ImportSecurityGroupsAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual security group sync failed");
            return StatusCode(500, new { error = "Sync operation failed" });
        }
    }

    [HttpPost("access-levels")]
    public async Task<IActionResult> AccessLevels(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Manual access levels sync triggered via API");
        try
        {
            var result = await _accessLevelImportService.ImportAccessLevelsAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual access levels sync failed");
            return StatusCode(500, new { error = "Sync operation failed" });
        }
    }

    [HttpPost("cardholders")]
    public async Task<IActionResult> Cardholders(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Manual cardholder sync triggered via API");
        try
        {
            var result = await _cardholderSyncService.SyncAllCardholdersAsync(cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual cardholder sync failed");
            return StatusCode(500, new { error = "Sync operation failed" });
        }
    }
}
