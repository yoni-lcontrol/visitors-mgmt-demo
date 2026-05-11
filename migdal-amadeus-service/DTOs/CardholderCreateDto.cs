namespace Amadeus8.DTOs;

public class CardholderCreateDto
{
    public string? CardholderIdNumber { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Description { get; set; }
    public string? CardholderTypeUid { get; set; }
    public string? SecurityGroupApiKey { get; set; }
    public List<string>? AccessGroupApiKeys { get; set; }
    public DateTime? FromDateValid { get; set; }
    public DateTime? ToDateValid { get; set; }
    public bool? IsFromDateActive { get; set; }
    public bool? IsToDateActive { get; set; }
    public string? LicensePlate { get; set; }
}
