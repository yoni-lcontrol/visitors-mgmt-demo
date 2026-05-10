using System.Text.Json.Serialization;

namespace Amadeus8.Models;

public class AmadeusCardholderPersonalDetails
{
    [JsonPropertyName("uid")]
    public string? Uid { get; set; }

    [JsonPropertyName("cardholderUID")]
    public string? CardholderUid { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("mobile")]
    public string? Mobile { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("street")]
    public string? Street { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("postCode")]
    public string? PostCode { get; set; }

    [JsonPropertyName("carLicensePlate")]
    public string? CarLicensePlate { get; set; }
}
