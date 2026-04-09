using Serilog;
using System;
using System.Threading;

namespace ScannerService
{
    /// <summary>
    /// Manages the scanner hardware lifecycle: polling for documents,
    /// detecting USB disconnect, and automatic reconnection.
    /// 
    /// Key design decisions for the Acuant/Gemalto COM SDK:
    /// 
    /// 1. The SDK does NOT throw COMException when USB is unplugged.
    ///    IsScannerValid silently returns 0. We detect disconnect by checking
    ///    the return value of CheckLicenseInsertTick() (which calls IsScannerValid).
    ///
    /// 2. On USB disconnect, we keep the COM objects and SnapServer alive.
    ///    When the USB is re-plugged, IsScannerValid starts returning 1 again.
    ///    We then call InitSDK() to re-establish the scanner session:
    ///    InitLibrary (handles "already initialized" error -13) + GrabMode = 0.
    ///    This restores PaperInTray auto-detection without killing SnapServer.
    ///
    /// 3. Only if the soft reconnect fails repeatedly (COM objects are stale or
    ///    SnapServer died), we fall back to full Reinitialize() which:
    ///    kills SnapServer → releases COM → recreates COM → reinits SDK.
    /// </summary>
    public class ScannerLifecycleManager : IDisposable
    {
        private readonly AgentConfig _config;
        private readonly Func<IScannerDevice> _deviceFactory;
        private readonly int _pollIntervalMs;
        private readonly int _reconnectIntervalMs;
        private readonly int _maxReconnectIntervalMs;

        /// <summary>
        /// Number of soft-reconnect attempts before escalating to full Reinitialize.
        /// Soft reconnect just checks IsScannerValid on existing COM objects.
        /// </summary>
        private const int SoftReconnectMaxAttempts = 5;

        private IScannerDevice _device;
        private bool _disposed;

        /// <summary>The current scanner device instance (may be null if creation failed).</summary>
        public IScannerDevice Scanner => _device;

        /// <summary>Current scanner hardware state.</summary>
        public ScannerState State => _device?.State ?? ScannerState.Disconnected;

        /// <summary>Fired when scanner hardware state changes (oldState, newState).</summary>
        public event Action<ScannerState, ScannerState> OnStateChanged;

        /// <summary>
        /// Create a new lifecycle manager with default Gemalto device factory.
        /// </summary>
        public ScannerLifecycleManager(
            AgentConfig config,
            int pollIntervalMs = 500,
            int reconnectIntervalMs = 3000,
            int maxReconnectIntervalMs = 30000)
            : this(config, () => new Gemalto(), pollIntervalMs, reconnectIntervalMs, maxReconnectIntervalMs)
        {
        }

        /// <summary>
        /// Create a new lifecycle manager with a custom device factory (for testing).
        /// </summary>
        public ScannerLifecycleManager(
            AgentConfig config,
            Func<IScannerDevice> deviceFactory,
            int pollIntervalMs = 500,
            int reconnectIntervalMs = 3000,
            int maxReconnectIntervalMs = 30000)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _deviceFactory = deviceFactory ?? throw new ArgumentNullException(nameof(deviceFactory));
            _pollIntervalMs = pollIntervalMs;
            _reconnectIntervalMs = reconnectIntervalMs;
            _maxReconnectIntervalMs = maxReconnectIntervalMs;
        }

        /// <summary>
        /// Attempt initial scanner initialization. Returns true if the scanner is ready.
        /// The device instance is kept alive even on failure — the run loop will call
        /// reconnect methods on it rather than creating new instances.
        /// </summary>
        public bool Initialize()
        {
            try
            {
                _device = _deviceFactory();
                _device.OnStateChanged += HandleStateChanged;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to create scanner device. Is the scanner connected?");
                _device = null;
                return false;
            }

            bool valid = _device.InitSDK();
            if (!valid)
            {
                Log.Warning("Scanner SDK initialization failed. Will attempt reconnection in the run loop.");
                return false;
            }

            Log.Information("Scanner initialized successfully. Scanner={Scanner}", _device.ScannerName);
            return true;
        }

        /// <summary>
        /// Main run loop: polls for documents, monitors connection, handles reconnection.
        /// Blocks until the CancellationToken is cancelled. Safe for Task.Run().
        /// </summary>
        public void Run(CancellationToken ct)
        {
            int reconnectAttempts = 0;

            while (!ct.IsCancellationRequested)
            {
                // ── Connected: poll for documents ───────────────────────
                if (_device != null && _device.State == ScannerState.Connected)
                {
                    reconnectAttempts = 0;

                    bool healthy;
                    try
                    {
                        healthy = _device.CheckLicenseInsertTick();
                    }
                    catch (ScannerDisconnectedException)
                    {
                        Log.Warning("Scanner USB disconnect detected during polling (exception)");
                        healthy = false;
                    }
                    catch (Exception ex)
                    {
                        Log.Error(ex, "Unexpected error during scanner polling");
                        healthy = _device.CheckConnection();
                    }

                    if (!healthy)
                    {
                        Log.Warning("Scanner disconnect detected — IsScannerValid returned false");
                        HandleDisconnect();
                        continue; // Skip sleep, go directly to reconnect flow
                    }

                    SafeSleep(_pollIntervalMs, ct);
                    continue;
                }

                // ── Disconnected/Error: attempt reconnection ────────────
                reconnectAttempts++;
                int delay = CalculateBackoffDelay(reconnectAttempts);

                Log.Information(
                    "Scanner not connected (state={State}). Reconnect attempt #{Attempt} in {Delay}ms...",
                    _device?.State.ToString() ?? "no-device", reconnectAttempts, delay);

                SafeSleep(delay, ct);
                if (ct.IsCancellationRequested) break;

                bool reconnected = AttemptReconnect(reconnectAttempts);
                if (reconnected)
                {
                    Log.Information("Scanner reconnected successfully on attempt #{Attempt}", reconnectAttempts);
                    reconnectAttempts = 0;
                }
            }

            Log.Information("Scanner lifecycle run loop exiting");
        }

        /// <summary>
        /// Set up the auto-scan event handler that routes scan results through the agent.
        /// </summary>
        public void WireScanCompletedEvent(Action<ScanResult> handler)
        {
            if (_device != null)
            {
                _device.OnScanCompleted += handler;
            }
        }

        /// <summary>
        /// Remove the auto-scan event handler.
        /// </summary>
        public void UnwireScanCompletedEvent(Action<ScanResult> handler)
        {
            if (_device != null)
            {
                _device.OnScanCompleted -= handler;
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            if (_device != null)
            {
                _device.OnStateChanged -= HandleStateChanged;
                _device.Dispose();
                _device = null;
            }
        }

        // ─── Private helpers ──────────────────────────────────────────

        /// <summary>
        /// Handle scanner disconnect.
        /// We intentionally do NOT release COM resources or kill SnapServer here.
        /// The COM objects and SnapServer stay alive so that when the USB is re-plugged,
        /// IsScannerValid automatically starts returning 1 again and PaperInTray detection
        /// resumes without reinitialization. This is the key to preserving auto-scan after reconnect.
        /// </summary>
        private void HandleDisconnect()
        {
            if (_device != null)
            {
                try
                {
                    // MarkDisconnected sets State = Disconnected WITHOUT releasing COM or SnapServer.
                    // This fires OnStateChanged through HandleStateChanged → RaiseStateChanged,
                    // and lets the run loop enter the reconnect branch.
                    // COM objects stay alive so PaperInTray detection resumes when USB is re-plugged.
                    _device.MarkDisconnected();
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Error marking scanner as disconnected");
                    RaiseStateChanged(ScannerState.Connected, ScannerState.Disconnected);
                }
            }
            else
            {
                RaiseStateChanged(ScannerState.Connected, ScannerState.Disconnected);
            }
        }

        /// <summary>
        /// Attempt reconnection using a two-phase strategy:
        /// 
        /// Phase 1 (soft reconnect): Check IsScannerValid on existing COM objects.
        ///   If the USB was re-plugged, IsScannerValid returns 1. Then call InitSDK()
        ///   to re-establish the scanner session (InitLibrary + GrabMode = 0).
        ///   This restores PaperInTray auto-detection without killing SnapServer.
        ///   InitSDK is safe to call on already-initialized COM objects (error -13 is ignored).
        /// 
        /// Phase 2 (hard reinitialize): If soft reconnect fails after several attempts,
        ///   the COM objects may be stale. Fall back to full Reinitialize() which
        ///   kills SnapServer → releases COM → recreates COM → reinits SDK.
        /// 
        /// Fallback: If no device exists (factory failed initially), try the factory again.
        /// </summary>
        private bool AttemptReconnect(int attemptNumber)
        {
            try
            {
                if (_device == null)
                {
                    // No device instance — try factory
                    _device = _deviceFactory();
                    _device.OnStateChanged += HandleStateChanged;

                    bool valid = _device.InitSDK();
                    if (valid && _device.IsScannerReady)
                    {
                        return true;
                    }
                    return false;
                }

                // Phase 1: Soft reconnect — USB back? Re-init SDK to restore PaperInTray detection.
                if (attemptNumber <= SoftReconnectMaxAttempts)
                {
                    bool usbPresent = _device.CheckConnection();
                    if (usbPresent)
                    {
                        // USB is back. Must call InitSDK() to re-establish the scanner session.
                        // The Acuant SDK loses PaperInTray detection after USB disconnect — just
                        // having IsScannerValid == 1 is not enough. InitLibrary + GrabMode = 0
                        // must be called again to restore auto-scan capability.
                        bool ready = _device.InitSDK();
                        if (ready)
                        {
                            Log.Information("Soft reconnect succeeded — SDK re-initialized (attempt #{Attempt})",
                                attemptNumber);
                            return true;
                        }
                        Log.Warning("Soft reconnect: USB present but InitSDK failed (attempt #{Attempt})",
                            attemptNumber);
                    }
                    else
                    {
                        Log.Debug("Soft reconnect: IsScannerValid still false (attempt #{Attempt}/{Max})",
                            attemptNumber, SoftReconnectMaxAttempts);
                    }
                    return false;
                }

                // Phase 2: Hard reinitialize — COM objects may be stale
                Log.Information("Soft reconnect exhausted ({Max} attempts). Escalating to full Reinitialize...",
                    SoftReconnectMaxAttempts);

                bool result = _device.Reinitialize();
                if (result && _device.IsScannerReady)
                {
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                Log.Warning("Scanner reconnect attempt failed: {Message}", ex.Message);
                return false;
            }
        }

        private int CalculateBackoffDelay(int attempt)
        {
            // Exponential backoff: base * 2^(attempt-1), capped at max
            double delay = _reconnectIntervalMs * Math.Pow(2, Math.Min(attempt - 1, 10));
            return (int)Math.Min(delay, _maxReconnectIntervalMs);
        }

        private void HandleStateChanged(ScannerState previous, ScannerState current)
        {
            RaiseStateChanged(previous, current);
        }

        private void RaiseStateChanged(ScannerState previous, ScannerState current)
        {
            try
            {
                OnStateChanged?.Invoke(previous, current);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Error in OnStateChanged handler");
            }
        }

        private static void SafeSleep(int ms, CancellationToken ct)
        {
            try
            {
                ct.WaitHandle.WaitOne(ms);
            }
            catch (OperationCanceledException) { /* normal shutdown */ }
            catch (ObjectDisposedException) { /* token disposed during shutdown */ }
        }
    }
}
