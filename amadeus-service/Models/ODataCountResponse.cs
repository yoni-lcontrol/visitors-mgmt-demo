using System.Text.Json.Serialization;

namespace Amadeus8.Models;

public class ODataCountResponse<T>
{
    [JsonPropertyName("value")]
    public List<T> Value { get; set; } = [];

    [JsonPropertyName("@odata.count")]
    public int? Count { get; set; }
}
