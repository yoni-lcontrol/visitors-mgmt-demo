using System.Net.Http.Json;
using Amadeus8.Configurations;
using Amadeus8.DTOs;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class BackendApiClient : IBackendApiClient
{
    private const int EventDispatchMaxAttempts = 3;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly BackendOptions _options;
    private readonly ILogger<BackendApiClient> _logger;

    public BackendApiClient(
        IHttpClientFactory httpClientFactory,
        IOptions<BackendOptions> options,
        ILogger<BackendApiClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<SyncResultDto> TriggerFullSyncAsync(CancellationToken cancellationToken)
    {
        var url = BackendApiDefinitions.BuildUrl(
            _options.BaseUrl,
            BackendApiDefinitions.Sync.StartupFull,
            nameof(BackendApiDefinitions.Sync.StartupFull));

        _logger.LogInformation("Calling backend full sync endpoint: {Url}", url);

        var client = _httpClientFactory.CreateClient("Backend");
        using var response = await client.PostAsync(url, content: null, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Backend full sync failed with status {(int)response.StatusCode} ({response.StatusCode}). Response: {errorBody}");
        }

        if (response.Content.Headers.ContentLength == 0)
        {
            return new SyncResultDto
            {
                Success = true,
                Operation = "FullStartup",
                StartedUtc = DateTime.UtcNow,
                CompletedUtc = DateTime.UtcNow
            };
        }

        return await response.Content.ReadFromJsonAsync<SyncResultDto>(cancellationToken)
            ?? new SyncResultDto
            {
                Success = true,
                Operation = "FullStartup",
                StartedUtc = DateTime.UtcNow,
                CompletedUtc = DateTime.UtcNow
            };
    }

    public Task<List<BackendControllerDto>> GetControllersAsync(CancellationToken cancellationToken)
    {
        return GetListAsync<BackendControllerDto>(BackendApiDefinitions.Resources.Controllers, nameof(BackendApiDefinitions.Resources.Controllers), cancellationToken);
    }

    public Task<List<BackendDoorDto>> GetDoorsAsync(CancellationToken cancellationToken)
    {
        return GetListAsync<BackendDoorDto>(BackendApiDefinitions.Resources.Doors, nameof(BackendApiDefinitions.Resources.Doors), cancellationToken);
    }

    public Task<List<BackendDoorIoDto>> GetDoorIosAsync(CancellationToken cancellationToken)
    {
        return GetListAsync<BackendDoorIoDto>(BackendApiDefinitions.Resources.DoorIos, nameof(BackendApiDefinitions.Resources.DoorIos), cancellationToken);
    }

    public Task<List<BackendExtensionDto>> GetExtensionsAsync(CancellationToken cancellationToken)
    {
        return GetListAsync<BackendExtensionDto>(BackendApiDefinitions.Resources.Extensions, nameof(BackendApiDefinitions.Resources.Extensions), cancellationToken);
    }

    public Task<List<BackendExtensionIoDto>> GetExtensionIosAsync(CancellationToken cancellationToken)
    {
        return GetListAsync<BackendExtensionIoDto>(BackendApiDefinitions.Resources.ExtensionIos, nameof(BackendApiDefinitions.Resources.ExtensionIos), cancellationToken);
    }

    public async Task SendAmadeusEventsAsync(
        IReadOnlyCollection<BackendAmadeusEventDto> events,
        CancellationToken cancellationToken)
    {
        if (events.Count == 0)
        {
            return;
        }

        var url = BackendApiDefinitions.BuildUrl(
            _options.BaseUrl,
            BackendApiDefinitions.Resources.AmadeusEventIngestion,
            nameof(BackendApiDefinitions.Resources.AmadeusEventIngestion));

        var client = _httpClientFactory.CreateClient("Backend");

        for (var attempt = 1; attempt <= EventDispatchMaxAttempts; attempt++)
        {
            try
            {
                _logger.LogInformation(
                    "Dispatching {Count} Amadeus events to backend (attempt {Attempt}/{MaxAttempts})",
                    events.Count,
                    attempt,
                    EventDispatchMaxAttempts);

                using var response = await client.PostAsJsonAsync(url, events, cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    return;
                }

                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);

                if (attempt == EventDispatchMaxAttempts)
                {
                    throw new InvalidOperationException(
                        $"Backend event dispatch failed with status {(int)response.StatusCode} ({response.StatusCode}). Response: {errorBody}");
                }

                _logger.LogWarning(
                    "Backend event dispatch failed with status {StatusCode}; will retry",
                    (int)response.StatusCode);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex) when (attempt < EventDispatchMaxAttempts)
            {
                _logger.LogWarning(
                    ex,
                    "Transient error sending Amadeus events to backend (attempt {Attempt}/{MaxAttempts})",
                    attempt,
                    EventDispatchMaxAttempts);
            }

            await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);
        }
    }

    private async Task<List<T>> GetListAsync<T>(string path, string endpointName, CancellationToken cancellationToken)
    {
        var url = BackendApiDefinitions.BuildUrl(_options.BaseUrl, path, endpointName);
        _logger.LogInformation("Fetching backend equipment data from {Url}", url);

        var client = _httpClientFactory.CreateClient("Backend");
        using var response = await client.GetAsync(url, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Backend request '{endpointName}' failed with status {(int)response.StatusCode} ({response.StatusCode}). Response: {errorBody}");
        }

        var items = await response.Content.ReadFromJsonAsync<List<T>>(cancellationToken);
        return items ?? [];
    }
}