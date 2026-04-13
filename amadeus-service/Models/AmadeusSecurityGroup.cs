using System.Text.Json.Serialization;

namespace Amadeus8.Models;

public class AmadeusSecurityGroup
{
    [JsonPropertyName("uid")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("apiKey")]
    public string? ApiKey { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}
