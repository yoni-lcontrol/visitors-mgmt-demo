namespace PrinterService;

/// <summary>
/// Strongly-typed configuration for the printer service.
/// Reads from appsettings.json via IConfiguration.
/// </summary>
public sealed class AgentConfig
{
    /// <summary>Port the local kiosk-facing WebSocket server listens on.</summary>
    public int LocalServerPort { get; private set; } = 5901;

    /// <summary>Shared secret the connecting kiosk must present in its hello handshake.</summary>
    public string LocalServerToken { get; private set; } = string.Empty;

    /// <summary>Machine identifier (informational only).</summary>
    public string MachineId { get; private set; } = Environment.MachineName;

    /// <summary>Service version (informational only).</summary>
    public string Version { get; private set; } = typeof(AgentConfig).Assembly.GetName().Version?.ToString() ?? "1.0.0";

    private AgentConfig() { }

    /// <summary>
    /// Load configuration from IConfiguration (appsettings.json).
    /// </summary>
    public static AgentConfig Load(IConfiguration configuration)
    {
        var section = configuration.GetSection("Agent");

        return new AgentConfig
        {
            LocalServerPort = int.TryParse(section["LocalServerPort"], out var port) ? port : 5901,
            LocalServerToken = section["LocalServerToken"] ?? string.Empty,
            MachineId = section["MachineId"] ?? Environment.MachineName,
        };
    }
}
