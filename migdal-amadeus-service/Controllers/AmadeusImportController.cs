using Amadeus8.DTOs;
using Amadeus8.Configurations;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/amadeus/import")]
public class AmadeusImportController : ControllerBase
{
    private readonly IAccessImportRoutingService _routingService;
    private readonly IOptions<AmadeusImportSettings> _importSettings;
    private readonly ILogger<AmadeusImportController> _logger;

    public AmadeusImportController(
        IAccessImportRoutingService routingService,
        IOptions<AmadeusImportSettings> importSettings,
        ILogger<AmadeusImportController> logger)
    {
        _routingService = routingService;
        _importSettings = importSettings;
        _logger = logger;
    }

    [HttpPost("access")]
    public async Task<IActionResult> ImportAccess(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting configured access import via API endpoint");

        var importAccessLevels = _importSettings.Value.ImportAccessLevels;
        _logger.LogInformation("Configured access import mode ImportAccessLevels={ImportAccessLevels}", importAccessLevels);

        if (!importAccessLevels.HasValue)
        {
            _logger.LogError("AmadeusImport:ImportAccessLevels configuration is missing or invalid");
            return BadRequest(new ImportSummaryResponseDto
            {
                Success = false,
                ImportType = string.Empty,
                Message = "AmadeusImport:ImportAccessLevels is missing/invalid. Allowed values: true (AccessLevels), false (AccessGroups)",
                Operation = "ImportAccess"
            });
        }

        var importType = importAccessLevels.Value
            ? AccessImportType.AccessLevels
            : AccessImportType.AccessGroups;

        try
        {
            var result = await _routingService.ImportAsync(importType, cancellationToken);
            var response = ToResponse(result, importType);

            if (!result.Success)
            {
                _logger.LogWarning("Configured access import returned failure for type {ImportType}: {Error}", importType, result.ErrorMessage);
                return StatusCode(500, response);
            }

            _logger.LogInformation("Completed configured access import for type {ImportType}", importType);
            return Ok(response);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while importing configured access type {ImportType}", importType);
            return StatusCode(500, new ImportSummaryResponseDto
            {
                Success = false,
                ImportType = importType.ToString(),
                Message = "Unexpected error while importing configured access type",
                Operation = "ImportAccess"
            });
        }
    }

    private static ImportSummaryResponseDto ToResponse(SyncResultDto result, AccessImportType importType)
    {
        return new ImportSummaryResponseDto
        {
            Success = result.Success,
            ImportType = importType.ToString(),
            Message = BuildMessage(importType, result),
            Operation = result.Operation,
            TotalReceived = result.TotalReceived,
            Created = result.Created,
            Updated = result.Updated,
            Skipped = result.Skipped,
            Failed = result.Failed,
            StartedUtc = result.StartedUtc,
            CompletedUtc = result.CompletedUtc
        };
    }

    private static string BuildMessage(AccessImportType importType, SyncResultDto result)
    {
        var importName = importType.ToString();

        if (!result.Success)
        {
            return string.IsNullOrWhiteSpace(result.ErrorMessage)
                ? $"{importName} import failed"
                : $"{importName} import failed: {result.ErrorMessage}";
        }

        if (result.Failed > 0)
        {
            return $"{importName} import completed with {result.Failed} failed records";
        }

        return $"{importName} import completed successfully";
    }
}
