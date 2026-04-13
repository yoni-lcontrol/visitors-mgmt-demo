using System.Text.Json.Serialization;

namespace Amadeus8.Models;

/// <summary>
/// Maps to GET /odata/API_Outputs.
/// TODO: Verify exact property names against Amadeus8 OData $metadata.
/// </summary>
public class AmadeusOutput
{
    [JsonPropertyName("uid")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("controllerUID")]
    public string? ControllerId { get; set; }

    [JsonPropertyName("moduleUID")]
    public string? ModuleId { get; set; }

    [JsonPropertyName("digitalOutputStatus")]
    public string? OutputType { get; set; }
}
