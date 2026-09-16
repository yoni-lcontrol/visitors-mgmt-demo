using System.ComponentModel.DataAnnotations;

namespace Amadeus8.Configurations;

public class AmadeusOptions
{
    public const string SectionName = "Amadeus";

    [Required]
    public string BaseUrl { get; set; } = string.Empty;

    [Required]
    public string TokenEndpoint { get; set; } = "/api/Token";

    public string RenewTokenEndpoint { get; set; } = "/api/Token/Renew";

    [Required]
    public string SignalRHubUrl { get; set; } = "/signalr/events";

    public string ApiKey { get; set; } = string.Empty;

    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string ClientCertificatePath { get; set; } = string.Empty;

    [Required]
    public string ClientCertificatePassword { get; set; } = string.Empty;

    [Required]
    public string ServerCertificatePath { get; set; } = string.Empty;

    public string ServerCertificatePassword { get; set; } = string.Empty;

    [Range(1, 1440)]
    public int FullSyncIntervalMinutes { get; set; } = 60;

    public bool StartupSyncEnabled { get; set; } = true;

    [Range(1, 300)]
    public int ListenerReconnectDelaySeconds { get; set; } = 15;

    [Range(1, 5000)]
    public int InfrastructureImportBatchSize { get; set; } = 200;

    [Range(1, 5000)]
    public int AccessGroupsImportBatchSize { get; set; } = 50;

    /// <summary>
    /// The Amadeus CardholderType UID that represents a Visitor.
    /// Obtain from GET /odata/API_CardholderTypes in the target environment.
    /// </summary>
    public string? VisitorCardholderTypeUid { get; set; }

    /// <summary>
    /// Default Multiple Access-Group (Security Group) API key assigned to visitors when none is specified.
    /// Maps to the "securityGroupApiKey" field in the Amadeus OData payload.
    /// </summary>
    public string? VisitorDefaultSecurityGroupApiKey { get; set; }

    /// <summary>
    /// Default Access Group API key assigned to visitors when no access groups are specified.
    /// Maps to the "accessGroupApiKeys" field in the Amadeus OData payload.
    /// </summary>
    public string? VisitorDefaultAccessGroupApiKey { get; set; }
}
