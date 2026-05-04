using System.ComponentModel.DataAnnotations;

namespace Amadeus8.DTOs;

public class CreateAmadeusVisitorDto
{
    [Required]
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    public DateTime FromDateValid { get; set; }

    [Required]
    public DateTime ToDateValid { get; set; }

    public string? CardholderIdNumber { get; set; }

    public string? SecurityGroupApiKey { get; set; }

    public List<string>? AccessGroupApiKeys { get; set; }

    public string? CardNumber { get; set; }

    public string? Email { get; set; }

    public string? Phone { get; set; }

    public string? Company { get; set; }

    public string? HostEmployeeId { get; set; }

    public string? Notes { get; set; }

    public string? DepartmentUid { get; set; }
}
