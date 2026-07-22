using System;
using System.Configuration;
using Serilog;

namespace ScannerService
{
    /// <summary>
    /// Strongly-typed configuration for the scanner service.
    /// Reads from App.config appSettings.
    /// </summary>
    public class AgentConfig
    {
        /// <summary>Port the local kiosk-facing WebSocket server listens on.</summary>
        public int LocalServerPort { get; private set; }

        /// <summary>Shared secret the connecting kiosk must present in its hello handshake.</summary>
        public string LocalServerToken { get; private set; }

        /// <summary>Acuant/Gemalto SDK license key.</summary>
        public string License { get; private set; }

        /// <summary>Machine identifier (informational only).</summary>
        public string MachineId { get; private set; }

        /// <summary>Scanner poll interval in milliseconds (how often to check for documents).</summary>
        public int ScannerPollIntervalMs { get; private set; }

        /// <summary>Base interval between scanner hardware reconnect attempts in milliseconds.</summary>
        public int ScannerReconnectIntervalMs { get; private set; }

        /// <summary>Maximum scanner reconnect interval with backoff in milliseconds.</summary>
        public int ScannerMaxReconnectIntervalMs { get; private set; }

        /// <summary>Service version (informational only).</summary>
        public string Version { get; private set; }

        private AgentConfig() { }

        /// <summary>
        /// Load configuration from App.config.
        /// </summary>
        public static AgentConfig Load()
        {
            return new AgentConfig
            {
                LocalServerPort = int.TryParse(ConfigurationManager.AppSettings["LocalServerPort"], out var port) ? port : 5900,
                LocalServerToken = ConfigurationManager.AppSettings["LocalServerToken"] ?? string.Empty,
                License = ConfigurationManager.AppSettings["License"] ?? string.Empty,
                MachineId = ConfigurationManager.AppSettings["MachineId"] ?? Environment.MachineName,
                ScannerPollIntervalMs = int.TryParse(ConfigurationManager.AppSettings["ScannerPollIntervalMs"], out var sp) ? sp : 500,
                ScannerReconnectIntervalMs = int.TryParse(ConfigurationManager.AppSettings["ScannerReconnectIntervalMs"], out var sr) ? sr : 3000,
                ScannerMaxReconnectIntervalMs = int.TryParse(ConfigurationManager.AppSettings["ScannerMaxReconnectIntervalMs"], out var smr) ? smr : 30000,
                Version = typeof(AgentConfig).Assembly.GetName().Version?.ToString() ?? "1.0.0",
            };
        }

        /// <summary>
        /// Create a minimal config for unit testing (no App.config dependency).
        /// </summary>
        public static AgentConfig LoadForTests()
        {
            return new AgentConfig
            {
                LocalServerPort = 15900,
                LocalServerToken = "test-token",
                License = string.Empty,
                MachineId = "TEST-MACHINE",
                ScannerPollIntervalMs = 50,
                ScannerReconnectIntervalMs = 50,
                ScannerMaxReconnectIntervalMs = 200,
                Version = "1.0.0-test",
            };
        }
    }
}
