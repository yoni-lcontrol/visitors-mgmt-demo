using System.Text.Json.Serialization;

namespace Amadeus8.Models;

/// <summary>
/// Maps to GET /odata/API_Controllers.
/// TODO: Verify exact property names against Amadeus8 OData $metadata.
/// </summary>
public class AmadeusController
{
    [JsonPropertyName("uid")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("apiKey")]
    public string? ApiKey { get; set; }

    [JsonPropertyName("networkUID")]
    public string? SiteId { get; set; }

    [JsonPropertyName("isActivated")]
    public bool? IsActive { get; set; }

    [JsonPropertyName("status")]
    public string? CommStatus { get; set; }
}
