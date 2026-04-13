using System.Text.Json.Serialization;

namespace Amadeus8.Models;

public class ODataResponse<T>
{
    [JsonPropertyName("value")]
    public List<T> Value { get; set; } = [];
}
