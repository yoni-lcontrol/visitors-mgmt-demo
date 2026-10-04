using System.ComponentModel.DataAnnotations;

namespace Amadeus8.Configurations;

/// <summary>
/// The mTLS client certificate this service presents to the Amadeus gateway and the Backend/ESB gateway.
/// Both gateways accept the same client certificate, so it is configured once and shared instead of
/// being duplicated under both the "Amadeus" and "Backend" sections.
/// </summary>
public class ClientCertificateOptions
{
    public const string SectionName = "ClientCertificate";

    [Required]
    public string Path { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}
