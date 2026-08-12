using System;
using System.Configuration;
using System.IO;
using System.Text.Json;
using Serilog;

namespace ScannerService
{
    /// <summary>
    /// Strongly-typed configuration for the scanner agent.
    /// Reads from App.config appSettings and the persisted credentials file.
    /// </summary>
    public class AgentConfig
    {
        private static readonly string CredentialsFilePath =
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "agent-credentials.json");

        /// <summary>
        /// The front server's public origin — the same host that serves the kiosk SPA
        /// (e.g., "https://kiosk.example.com", or "http://localhost:3000" for local dev
        /// against a bare backend with no proxy in front of it). This agent has no network
        /// route to the backend itself; the front server's IIS reverse proxy is what forwards
        /// this Socket.IO connection on to the backend's /ws/agents namespace. Never point
        /// this at the backend's own address directly.
        /// </summary>
        public string FrontServerUrl { get; private set; }

        /// <summary>HMAC client ID assigned during enrollment.</summary>
        public string ClientId { get; set; }

        /// <summary>HMAC client secret assigned during enrollment.</summary>
        public string ClientSecret { get; set; }

        /// <summary>Enrollment token for first-time registration (one-time use).</summary>
        public string EnrollmentToken { get; private set; }

        /// <summary>Acuant/Gemalto SDK license key.</summary>
        public string License { get; private set; }

        /// <summary>Machine identifier reported to backend on registration.</summary>
        public string MachineId { get; private set; }

        /// <summary>Heartbeat interval in milliseconds.</summary>
        public int HeartbeatIntervalMs { get; private set; }

        /// <summary>Reconnect delay in milliseconds after disconnect.</summary>
        public int ReconnectDelayMs { get; private set; }

        /// <summary>Scanner poll interval in milliseconds (how often to check for documents).</summary>
        public int ScannerPollIntervalMs { get; private set; }

        /// <summary>Base interval between scanner hardware reconnect attempts in milliseconds.</summary>
        public int ScannerReconnectIntervalMs { get; private set; }

        /// <summary>Maximum scanner reconnect interval with backoff in milliseconds.</summary>
        public int ScannerMaxReconnectIntervalMs { get; private set; }

        /// <summary>Agent version reported to backend.</summary>
        public string Version { get; private set; }

        /// <summary>Whether HMAC credentials have been persisted from a prior enrollment.</summary>
        public bool HasCredentials => !string.IsNullOrEmpty(ClientId) && !string.IsNullOrEmpty(ClientSecret);

        private AgentConfig() { }

        /// <summary>
        /// Load configuration from App.config and persisted credentials.
        /// </summary>
        public static AgentConfig Load()
        {
            var config = new AgentConfig
            {
                FrontServerUrl = ConfigurationManager.AppSettings["FrontServerUrl"] ?? "http://localhost:3000",
                EnrollmentToken = ConfigurationManager.AppSettings["EnrollmentToken"] ?? string.Empty,
                License = ConfigurationManager.AppSettings["License"] ?? string.Empty,
                MachineId = ConfigurationManager.AppSettings["MachineId"] ?? Environment.MachineName,
                HeartbeatIntervalMs = int.TryParse(ConfigurationManager.AppSettings["HeartbeatIntervalMs"], out var hb) ? hb : 30000,
                ReconnectDelayMs = int.TryParse(ConfigurationManager.AppSettings["ReconnectDelayMs"], out var rd) ? rd : 5000,
                ScannerPollIntervalMs = int.TryParse(ConfigurationManager.AppSettings["ScannerPollIntervalMs"], out var sp) ? sp : 500,
                ScannerReconnectIntervalMs = int.TryParse(ConfigurationManager.AppSettings["ScannerReconnectIntervalMs"], out var sr) ? sr : 3000,
                ScannerMaxReconnectIntervalMs = int.TryParse(ConfigurationManager.AppSettings["ScannerMaxReconnectIntervalMs"], out var smr) ? smr : 30000,
                Version = typeof(AgentConfig).Assembly.GetName().Version?.ToString() ?? "1.0.0",
            };

            // Try to load persisted HMAC credentials from a previous enrollment
            config.LoadCredentials();

            return config;
        }

        /// <summary>
        /// Create a minimal config for unit testing (no App.config dependency).
        /// </summary>
        public static AgentConfig LoadForTests()
        {
            return new AgentConfig
            {
                FrontServerUrl = "http://localhost:3000",
                EnrollmentToken = string.Empty,
                License = string.Empty,
                MachineId = "TEST-MACHINE",
                HeartbeatIntervalMs = 30000,
                ReconnectDelayMs = 100,
                ScannerPollIntervalMs = 50,
                ScannerReconnectIntervalMs = 50,
                ScannerMaxReconnectIntervalMs = 200,
                Version = "1.0.0-test",
            };
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

        private class CredentialData
        {
            public string ClientId { get; set; }
            public string ClientSecret { get; set; }
        }
    }
}
