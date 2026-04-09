namespace ScannerService
{
    /// <summary>
    /// Payload wrapper for scan results sent via the agent socket.
    /// Aligns with the backend AgentCommandResultPayload interface.
    /// </summary>
    public class ScannerSocketMessage
    {
        /// <summary>Correlation ID linking this result to a backend command.</summary>
        public string correlationId { get; set; } = string.Empty;

        /// <summary>Whether the scan was successful.</summary>
        public bool success { get; set; }

        /// <summary>The extracted scan data.</summary>
        public ScanResult result { get; set; }

        /// <summary>Error message if the scan failed.</summary>
        public string errorMessage { get; set; }
    }
}
