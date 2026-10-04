namespace Amadeus8.Configurations;

public class BackendOptions
{
    public const string SectionName = "Backend";

    public string BaseUrl { get; set; } = string.Empty;

    public string? ServerCertificatePath { get; set; }

    public string? ServerCertificatePassword { get; set; }
}