using Amadeus8.DTOs;

namespace Amadeus8.Services;

public class AccessImportRoutingService : IAccessImportRoutingService
{
    private readonly IAccessGroupImportService _accessGroupImportService;
    private readonly IAccessLevelImportService _accessLevelImportService;
    private readonly ILogger<AccessImportRoutingService> _logger;

    public AccessImportRoutingService(
        IAccessGroupImportService accessGroupImportService,
        IAccessLevelImportService accessLevelImportService,
        ILogger<AccessImportRoutingService> logger)
    {
        _accessGroupImportService = accessGroupImportService;
        _accessLevelImportService = accessLevelImportService;
        _logger = logger;
    }

    public async Task<SyncResultDto> ImportAsync(AccessImportType importType, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Routing configured access import type {ImportType}", importType);

        return importType switch
        {
            AccessImportType.AccessLevels => await _accessLevelImportService.ImportAccessLevelsAsync(cancellationToken),
            AccessImportType.AccessGroups => await _accessGroupImportService.ImportAccessGroupsAsync(cancellationToken),
            _ => throw new ArgumentOutOfRangeException(nameof(importType), importType, "Unsupported access import type")
        };
    }
}
