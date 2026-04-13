using System.Text.Json.Serialization;

namespace Amadeus8.Models;

/// <summary>
/// Maps to GET /odata/API_Readers.
/// TODO: Verify exact property names against Amadeus8 OData $metadata.
/// </summary>
public class AmadeusReader
{
    [JsonPropertyName("uid")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("controllerUID")]
    public string? ControllerId { get; set; }

    [JsonPropertyName("firstOutputUID")]
    public string? OutputId { get; set; }

    [JsonPropertyName("doorAlarmInputUID")]
    public string? DoorContactInputId { get; set; }
}
