using Amadeus8.DTOs;
using Amadeus8.Services;
using Microsoft.AspNetCore.Mvc;

namespace Amadeus8.Controllers;

[ApiController]
[Route("api/import")]
public class ImportBridgeController : ControllerBase
{
    private readonly IImportJobManager _importJobManager;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    private readonly ILogger<ImportBridgeController> _logger;

    public ImportBridgeController(
        IImportJobManager importJobManager,
        IServiceScopeFactory serviceScopeFactory,
        ILogger<ImportBridgeController> logger)
    {
        _importJobManager = importJobManager;
        _serviceScopeFactory = serviceScopeFactory;
        _logger = logger;
    }

    /// <summary>
    /// Starts an async device import job and returns immediately with a jobId.
    /// Poll GET /api/import/status/{jobId} for progress and results.
    /// </summary>
    [HttpPost]
    public IActionResult ImportDevices()
    {
        _logger.LogInformation("Device import request received — starting async job");

        var jobId = _importJobManager.StartJob();

        _ = Task.Run(async () =>
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var importBridgeService = scope.ServiceProvider.GetRequiredService<IImportBridgeService>();
            var jobManager = scope.ServiceProvider.GetRequiredService<IImportJobManager>();

            try
            {
                jobManager.UpdateProgress(jobId, "importing", null, null);
                var payload = await importBridgeService.ImportDevicesAsync(CancellationToken.None);
                jobManager.CompleteJob(jobId, payload);
            }
            catch (Exception ex)
            {
                jobManager.FailJob(jobId, ex.Message);
            }
        });

        return Accepted(new { jobId });
    }

    /// <summary>
    /// Returns the current status and result of an import job.
    /// </summary>
    [HttpGet("status/{jobId}")]
    public IActionResult GetImportStatus(string jobId)
    {
        var job = _importJobManager.GetJob(jobId);
        if (job == null)
        {
            return NotFound(new { message = $"Job {jobId} not found" });
        }

        if (job.Status == "Completed")
        {
            return Ok(new
            {
                job.Status,
                job.Phase,
                job.Processed,
                job.Total,
                job.Payload,
                job.AccessLevelPayload,
                job.StartedUtc,
                job.CompletedUtc,
            });
        }

        return Ok(new
        {
            job.Status,
            job.Phase,
            job.Processed,
            job.Total,
            job.ErrorMessage,
            job.StartedUtc,
        });
    }

    /// <summary>
    /// Starts an async access-level import job and returns immediately with a jobId.
    /// Poll GET /api/import/status/{jobId} for progress and results.
    /// </summary>
    [HttpPost("access-levels")]
    public IActionResult ImportAccessLevels()
    {
        _logger.LogInformation("Access-level import request received — starting async job");

        var jobId = _importJobManager.StartJob();

        _ = Task.Run(async () =>
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var importBridgeService = scope.ServiceProvider.GetRequiredService<IImportBridgeService>();
            var jobManager = scope.ServiceProvider.GetRequiredService<IImportJobManager>();

            try
            {
                jobManager.UpdateProgress(jobId, "importing", null, null);
                var payload = await importBridgeService.ImportAccessLevelsAsync(CancellationToken.None);
                jobManager.CompleteAccessLevelJob(jobId, payload);
            }
            catch (Exception ex)
            {
                jobManager.FailJob(jobId, ex.Message);
            }
        });

        return Accepted(new { jobId });
    }
}
