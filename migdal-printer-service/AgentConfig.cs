using System.Text.Json;
using Serilog;

namespace PrinterService;

/// <summary>
/// Strongly-typed configuration for the printer agent.
/// Reads from appsettings.json via IConfiguration and persists HMAC credentials to a local file.
/// </summary>
public sealed class AgentConfig
{
    private static readonly string CredentialsFilePath =
        Path.Combine(AppContext.BaseDirectory, "agent-credentials.json");

    /// <summary>Backend WebSocket server URL (e.g., "http://localhost:3000").</summary>
    public string ServerUrl { get; private set; } = "http://localhost:3000";

    /// <summary>HMAC client ID assigned during enrollment.</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>HMAC client secret assigned during enrollment.</summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>Enrollment token for first-time registration (one-time use).</summary>
    public string EnrollmentToken { get; private set; } = string.Empty;

    /// <summary>Machine identifier reported to backend on registration.</summary>
    public string MachineId { get; private set; } = Environment.MachineName;

    /// <summary>Heartbeat interval in milliseconds.</summary>
    public int HeartbeatIntervalMs { get; private set; } = 30_000;

    /// <summary>Reconnect delay in milliseconds after disconnect.</summary>
    public int ReconnectDelayMs { get; private set; } = 5_000;

    /// <summary>Agent version reported to backend.</summary>
    public string Version { get; private set; } = typeof(AgentConfig).Assembly.GetName().Version?.ToString() ?? "1.0.0";

    /// <summary>Whether HMAC credentials have been persisted from a prior enrollment.</summary>
    public bool HasCredentials => !string.IsNullOrEmpty(ClientId) && !string.IsNullOrEmpty(ClientSecret);

    private AgentConfig() { }

    /// <summary>
    /// Load configuration from IConfiguration (appsettings.json) and persisted credentials.
    /// </summary>
    public static AgentConfig Load(IConfiguration configuration)
    {
        var section = configuration.GetSection("Agent");

        var config = new AgentConfig
        {
            ServerUrl = section["ServerUrl"] ?? "http://localhost:3000",
            EnrollmentToken = section["EnrollmentToken"] ?? string.Empty,
            MachineId = section["MachineId"] ?? Environment.MachineName,
            HeartbeatIntervalMs = int.TryParse(section["HeartbeatIntervalMs"], out var hb) ? hb : 30_000,
            ReconnectDelayMs = int.TryParse(section["ReconnectDelayMs"], out var rd) ? rd : 5_000,
        };

        config.LoadCredentials();
        return config;
    }

    /// <summary>
    /// Persist HMAC credentials received after enrollment.
    /// </summary>
    public void SaveCredentials()
    {
        try
        {
            var data = new CredentialData { ClientId = ClientId, ClientSecret = ClientSecret };
            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(CredentialsFilePath, json);
            Log.Information("Agent credentials saved to {Path}", CredentialsFilePath);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to save agent credentials");
        }
    }

    private void LoadCredentials()
    {
        try
        {
            if (!File.Exists(CredentialsFilePath))
                return;

            var json = File.ReadAllText(CredentialsFilePath);
            var data = JsonSerializer.Deserialize<CredentialData>(json);
            if (data != null && !string.IsNullOrEmpty(data.ClientId) && !string.IsNullOrEmpty(data.ClientSecret))
            {
                ClientId = data.ClientId;
                ClientSecret = data.ClientSecret;
                Log.Information("Loaded persisted agent credentials (clientId: {ClientId})", ClientId);
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to load agent credentials — will attempt enrollment");
        }
    }

    private sealed class CredentialData
    {
        public string ClientId { get; set; } = string.Empty;
        public string ClientSecret { get; set; } = string.Empty;
    }
}
