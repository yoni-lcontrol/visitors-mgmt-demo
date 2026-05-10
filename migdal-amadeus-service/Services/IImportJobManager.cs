using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IImportJobManager
{
    string StartJob();
    void UpdateProgress(string jobId, string phase, int? processed, int? total);
    void CompleteJob(string jobId, ImportCallbackPayload payload);
    void CompleteAccessLevelJob(string jobId, AccessLevelCallbackPayload payload);
    void FailJob(string jobId, string errorMessage);
    ImportJobDto? GetJob(string jobId);
}
