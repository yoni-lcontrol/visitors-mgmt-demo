using System.Text.Json.Serialization;

namespace Amadeus8.Models;

public class AmadeusCard
{
    [JsonPropertyName("uid")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("cardholderUID")]
    public string? CardholderUid { get; set; }

    [JsonPropertyName("code")]
    public string? CardNumber { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("fromDateValid")]
    public DateTime? FromDateValid { get; set; }

    [JsonPropertyName("toDateValid")]
    public DateTime? ToDateValid { get; set; }

    [JsonPropertyName("isFromDateActive")]
    public bool? IsFromDateActive { get; set; }

    [JsonPropertyName("isToDateActive")]
    public bool? IsToDateActive { get; set; }
}
