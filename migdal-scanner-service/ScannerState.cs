namespace ScannerService
{
    /// <summary>
    /// Represents the connection state of the scanner hardware.
    /// </summary>
    public enum ScannerState
    {
        /// <summary>Scanner hardware is not connected or detected.</summary>
        Disconnected,

        /// <summary>Scanner is being initialized (COM objects + SDK).</summary>
        Connecting,

        /// <summary>Scanner is initialized, validated, and ready to scan.</summary>
        Connected,

        /// <summary>Scanner was previously connected but lost connection; attempting to recover.</summary>
        Reconnecting,

        /// <summary>Scanner initialization failed or an unrecoverable error occurred.</summary>
        Error,
    }
}
