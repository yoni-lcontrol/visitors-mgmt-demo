using System.Text.Json.Serialization;

namespace Amadeus8.Models;

/// <summary>
/// Token response from POST /api/Token.
/// Actual Amadeus8 response shape: {"token":"...","successful":true,"error":null,...}
/// </summary>
public class AmadeusTokenResponse
{
    [JsonPropertyName("token")]
    public string AccessToken { get; set; } = string.Empty;

    [JsonPropertyName("successful")]
    public bool Successful { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    // Amadeus does not return expires_in; use a safe default of 60 minutes.
    public int ExpiresIn { get; set; } = 3600;
}
