using System.Net.Http.Json;
using System.Net;
using Amadeus8.Configurations;
using Amadeus8.Models;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class AmadeusAuthService : IAmadeusAuthService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AmadeusOptions _options;
    private readonly ILogger<AmadeusAuthService> _logger;

    private string? _cachedToken;
    private DateTime _tokenExpiresUtc = DateTime.MinValue;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);

    public AmadeusAuthService(
        IHttpClientFactory httpClientFactory,
        IOptions<AmadeusOptions> options,
        ILogger<AmadeusAuthService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        if (_cachedToken is not null && DateTime.UtcNow < _tokenExpiresUtc.AddMinutes(-1))
        {
            return _cachedToken;
        }

        await _tokenLock.WaitAsync(cancellationToken);
        try
        {
            // Double-check after acquiring lock
            if (_cachedToken is not null && DateTime.UtcNow < _tokenExpiresUtc.AddMinutes(-1))
            {
                return _cachedToken;
            }

            return await AcquireTokenAsync(cancellationToken);
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    private async Task<string> AcquireTokenAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Requesting new Amadeus access token");

        var client = _httpClientFactory.CreateClient("Amadeus");

        // TODO: Verify exact token request body shape against real Amadeus8 server.
        // The payload may require ApiKey, Username, Password in a specific format.
        var requestBody = new
        {
            ApiKey = _options.ApiKey,
            Username = _options.Username,
            Password = _options.Password
        };

        var tokenUrl = AmadeusApiDefinitions.TokenUrl(_options);

        HttpResponseMessage response;
        while (true)
        {
            try
            {
                response = await client.PostAsJsonAsync(tokenUrl, requestBody, cancellationToken);
                break;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation("Amadeus token request canceled by application request");
                throw;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(
                    "Amadeus server unreachable at {TokenUrl}. Retrying in {Delay} seconds... Error: {Error}",
                    tokenUrl,
                    _options.ListenerReconnectDelaySeconds,
                    ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(_options.ListenerReconnectDelaySeconds), cancellationToken);
            }
            catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Amadeus token request timed out. Retrying in {Delay} seconds...",
                    _options.ListenerReconnectDelaySeconds);
                await Task.Delay(TimeSpan.FromSeconds(_options.ListenerReconnectDelaySeconds), cancellationToken);
            }
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError(
                    "Failed to acquire Amadeus token. Status: {StatusCode}, Response: {ErrorBody}",
                    response.StatusCode,
                    errorBody);

                if (response.StatusCode == HttpStatusCode.Unauthorized)
                {
                    throw new InvalidOperationException(
                        "Amadeus token request failed with status Unauthorized. " +
                        "Verify Amadeus Username/Password/ApiKey and token request payload contract. " +
                        $"Response: {TruncateForException(errorBody, 500)}");
                }

                throw new InvalidOperationException(
                    $"Amadeus token request failed with status {response.StatusCode}. " +
                    $"Response: {TruncateForException(errorBody, 500)}");
            }

            AmadeusTokenResponse? tokenResponse;
            try
            {
                tokenResponse = await response.Content.ReadFromJsonAsync<AmadeusTokenResponse>(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation("Amadeus token response read canceled by application request");
                throw;
            }
            catch (TaskCanceledException ex)
            {
                _logger.LogWarning(ex, "Amadeus token response read timed out or was aborted");
                throw new InvalidOperationException(
                    "Amadeus token response read timed out or was aborted by the transport layer.",
                    ex);
            }

            if (tokenResponse is null || string.IsNullOrWhiteSpace(tokenResponse.AccessToken))
            {
                var reason = tokenResponse?.Error ?? "empty response";
                _logger.LogError("Amadeus token response was empty or missing token. Reason: {Reason}", reason);
                throw new InvalidOperationException($"Amadeus token response was empty or missing token. Reason: {reason}");
            }

            _cachedToken = tokenResponse.AccessToken;
            _tokenExpiresUtc = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn);

            _logger.LogInformation(
                "Amadeus access token acquired successfully, expires in {ExpiresIn} seconds",
                tokenResponse.ExpiresIn);

            return _cachedToken;
        }
    }

    private static string TruncateForException(string value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "<empty>";
        }

        return value.Length <= maxLength
            ? value
            : value[..maxLength] + "...";
    }
}
