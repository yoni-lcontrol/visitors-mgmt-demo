namespace Amadeus8.DTOs;

public class CardholderDto
{
    public int Id { get; set; }
    public string AmadeusUid { get; set; } = string.Empty;
    public string? CardholderIdNumber { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public string? SecurityGroupUid { get; set; }
    public string? SecurityGroupApiKey { get; set; }
    public string? AccessGroupUidsRaw { get; set; }
    public string? AccessGroupApiKeysRaw { get; set; }
    public bool IsDeleted { get; set; }
    public bool IsArchived { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
