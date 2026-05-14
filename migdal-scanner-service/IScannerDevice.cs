using System;

namespace ScannerService
{
    /// <summary>
    /// Abstraction over scanner hardware for testability.
    /// Gemalto implements this for real hardware; tests use fakes.
    /// </summary>
    public interface IScannerDevice : IDisposable
    {
        /// <summary>Whether the scanner hardware is initialized and valid.</summary>
        bool IsScannerReady { get; }

        /// <summary>Current connection state of the scanner hardware.</summary>
        ScannerState State { get; }

        /// <summary>Display name of the detected scanner model.</summary>
        string ScannerName { get; }

        /// <summary>Callback invoked when a document is auto-scanned from the tray.</summary>
        event Action<ScanResult> OnScanCompleted;

        /// <summary>Callback invoked when scanning begins (paper detected or command received).</summary>
        event Action OnScanStarted;

        /// <summary>Callback invoked when scanner connection state changes.</summary>
        event Action<ScannerState, ScannerState> OnStateChanged;

        /// <summary>Initialize the scanner SDK. Returns true if ready.</summary>
        bool InitSDK();

        /// <summary>Release COM resources and reset state.</summary>
        void ReleaseResources();

        /// <summary>
        /// Mark the scanner as disconnected without releasing COM resources.
        /// Used for soft disconnect — keeps COM/SnapServer alive so the SDK
        /// auto-recovers when USB is re-plugged.
        /// </summary>
        void MarkDisconnected();

        /// <summary>Check if scanner is physically connected. Returns true if valid.</summary>
        bool CheckConnection();

        /// <summary>
        /// Poll for a document in the tray. Returns true if scanner is healthy.
        /// Throws ScannerDisconnectedException on USB disconnect.
        /// </summary>
        bool CheckLicenseInsertTick();

        /// <summary>
        /// Fully reinitialize the scanner: release COM, kill SnapServer, recreate COM, reinit SDK.
        /// Used for reconnection after USB disconnect. Returns true if scanner is ready.
        /// </summary>
        bool Reinitialize();

        /// <summary>Execute a scan command from the backend. Returns scan result.</summary>
        ScanResult ExecuteScanCommand();
    }
}
