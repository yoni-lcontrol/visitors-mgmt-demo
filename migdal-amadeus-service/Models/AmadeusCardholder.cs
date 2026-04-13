using System.Text.Json.Serialization;

namespace Amadeus8.Models;

public class AmadeusCardholder
{
    [JsonPropertyName("uid")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("cardholderIdNumber")]
    public string? CardholderIdNumber { get; set; }

    [JsonPropertyName("firstName")]
    public string? FirstName { get; set; }

    [JsonPropertyName("lastName")]
    public string? LastName { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("cardholderTypeUID")]
    public string? CardholderTypeId { get; set; }

    [JsonPropertyName("departmentUID")]
    public string? DepartmentId { get; set; }

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

    [JsonPropertyName("securityGroupUID")]
    public string? SecurityGroupId { get; set; }

    [JsonPropertyName("securityGroupApiKey")]
    public string? SecurityGroupApiKey { get; set; }

    [JsonPropertyName("accessGroupUIDs")]
    public string? AccessGroupIds { get; set; }

    [JsonPropertyName("accessGroupApiKeys")]
    public string? AccessGroupApiKeys { get; set; }

    [JsonPropertyName("lastDownloadTime")]
    public DateTime? LastDownloadTime { get; set; }
}
