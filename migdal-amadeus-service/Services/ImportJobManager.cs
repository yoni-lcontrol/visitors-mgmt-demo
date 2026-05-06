using System.Collections.Concurrent;
using Amadeus8.DTOs;

namespace Amadeus8.Services;

public class ImportJobManager : IImportJobManager
{
    private readonly ConcurrentDictionary<string, ImportJobDto> _jobs = new();
    private readonly ILogger<ImportJobManager> _logger;
    private readonly Timer _cleanupTimer;

    public ImportJobManager(ILogger<ImportJobManager> logger)
    {
        _logger = logger;
        _cleanupTimer = new Timer(CleanupOldJobs, null, TimeSpan.FromMinutes(10), TimeSpan.FromMinutes(10));
    }

    public string StartJob()
    {
        var jobId = Guid.NewGuid().ToString("N");
        _jobs[jobId] = new ImportJobDto
        {
            JobId = jobId,
            Status = "Pending",
            StartedUtc = DateTime.UtcNow,
        };
        _logger.LogInformation("Import job {JobId} created", jobId);
        return jobId;
    }

    public void UpdateProgress(string jobId, string phase, int? processed, int? total)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            job.Status = "Running";
            job.Phase = phase;
            job.Processed = processed;
            job.Total = total;
        }
    }

    public void CompleteJob(string jobId, ImportCallbackPayload payload)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            job.Status = "Completed";
            job.Payload = payload;
            job.CompletedUtc = DateTime.UtcNow;
            _logger.LogInformation("Import job {JobId} completed", jobId);
        }
    }

    public void FailJob(string jobId, string errorMessage)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            job.Status = "Failed";
            job.ErrorMessage = errorMessage;
            job.CompletedUtc = DateTime.UtcNow;
            _logger.LogWarning("Import job {JobId} failed: {Error}", jobId, errorMessage);
        }
    }

    public ImportJobDto? GetJob(string jobId)
    {
        _jobs.TryGetValue(jobId, out var job);
        return job;
    }

    private void CleanupOldJobs(object? state)
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-30);
        foreach (var kvp in _jobs)
        {
            if (kvp.Value.CompletedUtc.HasValue && kvp.Value.CompletedUtc.Value < cutoff)
            {
                _jobs.TryRemove(kvp.Key, out _);
                _logger.LogDebug("Cleaned up old import job {JobId}", kvp.Key);
            }
        }
    }
}
