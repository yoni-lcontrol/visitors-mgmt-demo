using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Amadeus8.Configurations;
using Amadeus8.Models;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class AmadeusApiClient : IAmadeusApiClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IAmadeusAuthService _authService;
    private readonly AmadeusOptions _options;
    private readonly ILogger<AmadeusApiClient> _logger;

    public AmadeusApiClient(
        IHttpClientFactory httpClientFactory,
        IAmadeusAuthService authService,
        IOptions<AmadeusOptions> options,
        ILogger<AmadeusApiClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _authService = authService;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<List<AmadeusController>> GetControllersAsync(CancellationToken cancellationToken)
    {
        return await GetODataCollectionAsync<AmadeusController>(AmadeusApiDefinitions.OData.Controllers, cancellationToken);
    }

    public async Task<(List<AmadeusController> Items, int? TotalCount)> GetControllersPagedAsync(int skip, int top, CancellationToken cancellationToken)
    {
        return await GetODataCollectionPageAsync<AmadeusController>(
            AmadeusApiDefinitions.OData.ControllersPaged(skip, top),
            skip,
            top,
            cancellationToken);
    }

    public async Task<List<AmadeusReader>> GetReadersAsync(CancellationToken cancellationToken)
    {
        return await GetODataCollectionAsync<AmadeusReader>(AmadeusApiDefinitions.OData.Readers, cancellationToken);
    }

    public async Task<(List<AmadeusReader> Items, int? TotalCount)> GetReadersPagedAsync(int skip, int top, CancellationToken cancellationToken)
    {
        return await GetODataCollectionPageAsync<AmadeusReader>(
            AmadeusApiDefinitions.OData.ReadersPaged(skip, top),
            skip,
            top,
            cancellationToken);
    }

    public async Task<List<AmadeusInput>> GetInputsAsync(CancellationToken cancellationToken)
    {
        return await GetODataCollectionAsync<AmadeusInput>(AmadeusApiDefinitions.OData.Inputs, cancellationToken);
    }

    public async Task<(List<AmadeusInput> Items, int? TotalCount)> GetInputsPagedAsync(int skip, int top, CancellationToken cancellationToken)
    {
        return await GetODataCollectionPageAsync<AmadeusInput>(
            AmadeusApiDefinitions.OData.InputsPaged(skip, top),
            skip,
            top,
            cancellationToken);
    }

    public async Task<List<AmadeusOutput>> GetOutputsAsync(CancellationToken cancellationToken)
    {
        return await GetODataCollectionAsync<AmadeusOutput>(AmadeusApiDefinitions.OData.Outputs, cancellationToken);
    }

    public async Task<(List<AmadeusOutput> Items, int? TotalCount)> GetOutputsPagedAsync(int skip, int top, CancellationToken cancellationToken)
    {
        return await GetODataCollectionPageAsync<AmadeusOutput>(
            AmadeusApiDefinitions.OData.OutputsPaged(skip, top),
            skip,
            top,
            cancellationToken);
    }

    public async Task<List<AmadeusSecurityGroup>> GetSecurityGroupsAsync(CancellationToken cancellationToken)
    {
        return await GetODataCollectionAsync<AmadeusSecurityGroup>(AmadeusApiDefinitions.OData.SecurityGroups, cancellationToken);
    }

    public async Task<(List<AmadeusSecurityGroup> Items, int? TotalCount)> GetSecurityGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken)
    {
        return await GetODataCollectionPageAsync<AmadeusSecurityGroup>(
            AmadeusApiDefinitions.OData.SecurityGroupsPaged(skip, top),
            skip,
            top,
            cancellationToken);
    }

    public async Task<List<AmadeusAccessGroup>> GetAccessGroupsAsync(CancellationToken cancellationToken)
    {
        return await GetODataCollectionAsync<AmadeusAccessGroup>(AmadeusApiDefinitions.OData.AccessGroups, cancellationToken);
    }

    public async Task<(List<AmadeusAccessGroup> Items, int? TotalCount)> GetAccessGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken)
    {
        return await GetODataCollectionPageAsync<AmadeusAccessGroup>(
            AmadeusApiDefinitions.OData.AccessGroupsPaged(skip, top),
            skip,
            top,
            cancellationToken);
    }

    public async Task<(List<AmadeusCardholder> Items, int? TotalCount)> GetCardholdersPagedAsync(int skip, int top, CancellationToken cancellationToken)
    {
        var relativePath = AmadeusApiDefinitions.OData.CardholdersPaged(skip, top);
        _logger.LogInformation("Fetching cardholders page skip={Skip} top={Top}", skip, top);

        var client = await CreateAuthenticatedClientAsync(cancellationToken);
        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, nameof(AmadeusApiDefinitions.OData.CardholdersPaged));
        using var response = await client.GetAsync(url, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Cardholders paged fetch failed. Status: {StatusCode}, Response: {ErrorBody}", response.StatusCode, errorBody);
            throw new HttpRequestException($"Cardholders paged fetch failed with status {response.StatusCode}");
        }

        var result = await response.Content.ReadFromJsonAsync<ODataCountResponse<AmadeusCardholder>>(cancellationToken);
        var items = result?.Value ?? [];
        _logger.LogInformation("Fetched {Count} cardholders (total: {Total})", items.Count, result?.Count);
        return (items, result?.Count);
    }

    public async Task<AmadeusCardholder?> GetCardholderByUidAsync(string uid, CancellationToken cancellationToken)
    {
        var relativePath = AmadeusApiDefinitions.OData.CardholderByUid(uid);
        _logger.LogInformation("Fetching cardholder by UID {Uid}", uid);

        var client = await CreateAuthenticatedClientAsync(cancellationToken);
        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, nameof(AmadeusApiDefinitions.OData.CardholderByUid));
        using var response = await client.GetAsync(url, cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning("Cardholder {Uid} not found in Amadeus", uid);
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Cardholder fetch failed. Status: {StatusCode}, Response: {ErrorBody}", response.StatusCode, errorBody);
            throw new HttpRequestException($"Cardholder fetch failed with status {response.StatusCode}");
        }

        return await response.Content.ReadFromJsonAsync<AmadeusCardholder>(cancellationToken);
    }

    public async Task<AmadeusCardholder?> GetCardholderByIdNumberAsync(string cardholderIdNumber, CancellationToken cancellationToken)
    {
        var relativePath = AmadeusApiDefinitions.OData.CardholdersByIdNumber(cardholderIdNumber);
        _logger.LogInformation("Searching cardholder by IdNumber {IdNumber}", cardholderIdNumber);

        var client = await CreateAuthenticatedClientAsync(cancellationToken);
        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, nameof(AmadeusApiDefinitions.OData.CardholdersByIdNumber));
        using var response = await client.GetAsync(url, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Cardholder search by IdNumber failed. Status: {StatusCode}, Response: {ErrorBody}", response.StatusCode, errorBody);
            return null;
        }

        var result = await response.Content.ReadFromJsonAsync<ODataCountResponse<AmadeusCardholder>>(cancellationToken);
        return result?.Value?.FirstOrDefault();
    }

    public async Task<AmadeusCardholder> CreateCardholderAsync(object payload, CancellationToken cancellationToken)
    {
        var relativePath = AmadeusApiDefinitions.OData.Cardholders;
        _logger.LogInformation("Creating cardholder in Amadeus");

        var client = await CreateAuthenticatedClientAsync(cancellationToken);
        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, nameof(AmadeusApiDefinitions.OData.Cardholders));
        var json = JsonSerializer.Serialize(payload);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(url, content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Cardholder create failed. Status: {StatusCode}, Response: {ErrorBody}", response.StatusCode, errorBody);
            throw new HttpRequestException($"Cardholder create failed with status {response.StatusCode}: {errorBody}");
        }

        var created = await response.Content.ReadFromJsonAsync<AmadeusCardholder>(cancellationToken);
        _logger.LogInformation("Cardholder created with Amadeus UID {Uid}", created?.Id);
        return created!;
    }

    public async Task UpdateCardholderAsync(string uid, object payload, CancellationToken cancellationToken)
    {
        var relativePath = AmadeusApiDefinitions.OData.CardholderByUid(uid);
        _logger.LogInformation("Updating cardholder {Uid} in Amadeus", uid);

        var client = await CreateAuthenticatedClientAsync(cancellationToken);
        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, nameof(AmadeusApiDefinitions.OData.CardholderByUid));
        var json = JsonSerializer.Serialize(payload);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var request = new HttpRequestMessage(HttpMethod.Patch, url) { Content = content };
        using var response = await client.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Cardholder update failed. Status: {StatusCode}, Response: {ErrorBody}", response.StatusCode, errorBody);
            throw new HttpRequestException($"Cardholder update failed with status {response.StatusCode}: {errorBody}");
        }

        _logger.LogInformation("Cardholder {Uid} updated successfully", uid);
    }

    public async Task DeleteCardholderAsync(string uid, CancellationToken cancellationToken)
    {
        var relativePath = AmadeusApiDefinitions.OData.CardholderByUid(uid);
        _logger.LogInformation("Deleting cardholder {Uid} from Amadeus", uid);

        var client = await CreateAuthenticatedClientAsync(cancellationToken);
        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, nameof(AmadeusApiDefinitions.OData.CardholderByUid));
        using var response = await client.DeleteAsync(url, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Cardholder delete failed. Status: {StatusCode}, Response: {ErrorBody}", response.StatusCode, errorBody);
            throw new HttpRequestException($"Cardholder delete failed with status {response.StatusCode}: {errorBody}");
        }

        _logger.LogInformation("Cardholder {Uid} deleted successfully", uid);
    }

    public async Task<AmadeusCardholderPersonalDetails?> GetCardholderPersonalDetailsAsync(string cardholderUid, CancellationToken cancellationToken)
    {
        var relativePath = AmadeusApiDefinitions.OData.CardholderPersonalDetailsByCardholderUid(cardholderUid);
        _logger.LogInformation("Fetching personal details for cardholder {Uid}", cardholderUid);

        var client = await CreateAuthenticatedClientAsync(cancellationToken);
        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, nameof(AmadeusApiDefinitions.OData.CardholderPersonalDetails));
        using var response = await client.GetAsync(url, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Personal details fetch failed for cardholder {Uid}. Status: {StatusCode}, Response: {ErrorBody}", cardholderUid, response.StatusCode, errorBody);
            throw new HttpRequestException($"Personal details fetch failed with status {response.StatusCode}");
        }

        var result = await response.Content.ReadFromJsonAsync<ODataResponse<AmadeusCardholderPersonalDetails>>(cancellationToken);
        return result?.Value?.FirstOrDefault();
    }

    public async Task<AmadeusCardholderPersonalDetails> UpsertLicensePlateAsync(string cardholderUid, string licensePlate, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Upserting license plate for cardholder {Uid}", cardholderUid);

        var existing = await GetCardholderPersonalDetailsAsync(cardholderUid, cancellationToken);
        var client = await CreateAuthenticatedClientAsync(cancellationToken);

        if (existing?.Uid is not null)
        {
            // PATCH existing personal details record
            var relativePath = AmadeusApiDefinitions.OData.CardholderPersonalDetailsByUid(existing.Uid);
            var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, nameof(AmadeusApiDefinitions.OData.CardholderPersonalDetails));
            var patchPayload = new { carRegistrationNum = licensePlate };
            var json = JsonSerializer.Serialize(patchPayload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var request = new HttpRequestMessage(HttpMethod.Patch, url) { Content = content };
            using var response = await client.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("License plate update failed for cardholder {Uid}. Status: {StatusCode}, Response: {ErrorBody}", cardholderUid, response.StatusCode, errorBody);
                throw new HttpRequestException($"License plate update failed with status {response.StatusCode}: {errorBody}");
            }

            existing.CarLicensePlate = licensePlate;
            _logger.LogInformation("License plate updated for cardholder {Uid}", cardholderUid);
            return existing;
        }
        else
        {
            // POST new personal details record
            var url = AmadeusApiDefinitions.ODataUrl(_options, AmadeusApiDefinitions.OData.CardholderPersonalDetails, nameof(AmadeusApiDefinitions.OData.CardholderPersonalDetails));
            var postPayload = new { cardholderUID = cardholderUid, carRegistrationNum = licensePlate };
            var json = JsonSerializer.Serialize(postPayload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var response = await client.PostAsync(url, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("License plate create failed for cardholder {Uid}. Status: {StatusCode}, Response: {ErrorBody}", cardholderUid, response.StatusCode, errorBody);
                throw new HttpRequestException($"License plate create failed with status {response.StatusCode}: {errorBody}");
            }

            var created = await response.Content.ReadFromJsonAsync<AmadeusCardholderPersonalDetails>(cancellationToken);
            _logger.LogInformation("Personal details with license plate created for cardholder {Uid}", cardholderUid);
            return created!;
        }
    }

    private async Task<List<T>> GetODataCollectionAsync<T>(string relativePath, CancellationToken cancellationToken)
    {
        var endpointName = relativePath;
        _logger.LogInformation("Fetching Amadeus data from {Endpoint}", endpointName);

        var client = await CreateAuthenticatedClientAsync(cancellationToken);

        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, endpointName);
        using var response = await client.GetAsync(url, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError(
                "Amadeus API call to {Endpoint} failed. Status: {StatusCode}, Response: {ErrorBody}",
                endpointName,
                response.StatusCode,
                errorBody);
            throw new HttpRequestException(
                $"Amadeus API call to {endpointName} failed with status {response.StatusCode}");
        }

        var result = await response.Content.ReadFromJsonAsync<ODataResponse<T>>(cancellationToken);

        var count = result?.Value?.Count ?? 0;
        _logger.LogInformation("Fetched {Count} records from {Endpoint}", count, endpointName);

        return result?.Value ?? [];
    }

    private async Task<(List<T> Items, int? TotalCount)> GetODataCollectionPageAsync<T>(
        string relativePath,
        int skip,
        int top,
        CancellationToken cancellationToken)
    {
        var endpointName = relativePath;
        _logger.LogInformation("Fetching Amadeus page from {Endpoint} with skip={Skip}, top={Top}", endpointName, skip, top);

        var client = await CreateAuthenticatedClientAsync(cancellationToken);

        var url = AmadeusApiDefinitions.ODataUrl(_options, relativePath, endpointName);
        using var response = await client.GetAsync(url, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);

            // Some Amadeus OData entity sets may reject $count=true with HTTP 400.
            // Fallback once without $count while preserving paging parameters.
            if (response.StatusCode == System.Net.HttpStatusCode.BadRequest &&
                relativePath.Contains("$count=true", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning(
                    "Amadeus paged API call to {Endpoint} returned BadRequest with $count=true. Retrying without $count. Response: {ErrorBody}",
                    endpointName,
                    errorBody);

                var fallbackRelativePath = relativePath
                    .Replace("&$count=true", string.Empty, StringComparison.OrdinalIgnoreCase)
                    .Replace("?$count=true", string.Empty, StringComparison.OrdinalIgnoreCase);

                var fallbackUrl = AmadeusApiDefinitions.ODataUrl(_options, fallbackRelativePath, endpointName + " (without $count)");
                using var fallbackResponse = await client.GetAsync(fallbackUrl, cancellationToken);

                if (!fallbackResponse.IsSuccessStatusCode)
                {
                    var fallbackErrorBody = await fallbackResponse.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogWarning(
                        "Amadeus paged API fallback call to {Endpoint} (without $count) also failed. Status: {StatusCode}. Attempting full fetch without paging. Response: {ErrorBody}",
                        endpointName,
                        fallbackResponse.StatusCode,
                        fallbackErrorBody);

                    // Final fallback: fetch all records without any OData query params
                    var baseEntityPath = relativePath.Split('?')[0];
                    var noPagingUrl = AmadeusApiDefinitions.ODataUrl(_options, baseEntityPath, endpointName + " (no paging)");
                    using var noPagingResponse = await client.GetAsync(noPagingUrl, cancellationToken);

                    if (!noPagingResponse.IsSuccessStatusCode)
                    {
                        var noPagingErrorBody = await noPagingResponse.Content.ReadAsStringAsync(cancellationToken);
                        _logger.LogError(
                            "Amadeus API call to {Endpoint} (no paging) also failed. Status: {StatusCode}, Response: {ErrorBody}",
                            endpointName,
                            noPagingResponse.StatusCode,
                            noPagingErrorBody);

                        throw new HttpRequestException(
                            $"Amadeus paged API call to {endpointName} failed with status {noPagingResponse.StatusCode} (all fallbacks exhausted)");
                    }

                    var noPagingResult = await noPagingResponse.Content.ReadFromJsonAsync<ODataResponse<T>>(cancellationToken);
                    var noPagingItems = noPagingResult?.Value ?? [];

                    _logger.LogInformation(
                        "Fetched {Count} records from {Endpoint} using full fetch (no paging). Only first page will be used.",
                        noPagingItems.Count,
                        endpointName);

                    // Return all items — caller will break out of paging loop since count < batch size
                    return (noPagingItems, noPagingItems.Count);
                }

                var fallbackResult = await fallbackResponse.Content.ReadFromJsonAsync<ODataResponse<T>>(cancellationToken);
                var fallbackItems = fallbackResult?.Value ?? [];

                _logger.LogInformation(
                    "Fetched {Count} records from {Endpoint} (skip={Skip}, top={Top}) using fallback without $count",
                    fallbackItems.Count,
                    endpointName,
                    skip,
                    top);

                return (fallbackItems, null);
            }

            _logger.LogError(
                "Amadeus paged API call to {Endpoint} failed. Status: {StatusCode}, Response: {ErrorBody}",
                endpointName,
                response.StatusCode,
                errorBody);
            throw new HttpRequestException(
                $"Amadeus paged API call to {endpointName} failed with status {response.StatusCode}");
        }

        var result = await response.Content.ReadFromJsonAsync<ODataCountResponse<T>>(cancellationToken);
        var items = result?.Value ?? [];
        _logger.LogInformation(
            "Fetched {Count} records from {Endpoint} (skip={Skip}, top={Top}, total={Total})",
            items.Count,
            endpointName,
            skip,
            top,
            result?.Count);

        return (items, result?.Count);
    }

    private async Task<HttpClient> CreateAuthenticatedClientAsync(CancellationToken cancellationToken)
    {
        var token = await _authService.GetAccessTokenAsync(cancellationToken);
        var client = _httpClientFactory.CreateClient("Amadeus");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
