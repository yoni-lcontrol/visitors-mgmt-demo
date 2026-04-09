using Serilog;
using System;
using System.Configuration;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;

namespace ScannerService
{
    public class Gemalto : IScannerDevice
    {
        /*Declaring Scanner Objects*/
        private NetScanW.SLibExClass _sLib;
        private NetScanWex.SLibExClass _sLibEx;

        /*Declaring Image Objects*/
        private NetScanW.CImageClass _image;
        private NetScanWex.CImageClass _imageEx;

        /*Declaring ID Objects*/
        private NetScanW.IdDataClass _idData;
        private NetScanWex.IdDataClass _idDataEx;

        /* Hebrew SDK requires NetScanW64.COcrClass to be intialized too */
        private NetScanW.COcrClass _ocrLib;

        private string region = "Asia";
        private string license = ConfigurationManager.AppSettings["License"].ToString();
        private string imagebuffer;
        private string _lastImageBase64;

        private bool scanning = false;
        private bool processing = false;
        private bool _disposed = false;
        private readonly object _stateLock = new object();
        private ScannerState _state = ScannerState.Disconnected;

        /// <summary>Callback invoked when a document is scanned (auto-detect from tray).</summary>
        public event Action<ScanResult> OnScanCompleted;

        /// <summary>Callback invoked when scanner connection state changes.</summary>
        public event Action<ScannerState, ScannerState> OnStateChanged;

        /// <summary>Whether the scanner hardware is initialized and valid.</summary>
        public bool IsScannerReady
        {
            get
            {
                try
                {
                    return _sLib?.IsScannerValid == 1;
                }
                catch (COMException)
                {
                    return false;
                }
                catch (InvalidComObjectException)
                {
                    return false;
                }
            }
        }

        /// <summary>Current connection state of the scanner hardware.</summary>
        public ScannerState State
        {
            get { lock (_stateLock) { return _state; } }
            private set
            {
                ScannerState previous;
                lock (_stateLock)
                {
                    if (_state == value) return;
                    previous = _state;
                    _state = value;
                }
                Log.Information("Scanner state changed: {Previous} -> {Current}", previous, value);
                try { OnStateChanged?.Invoke(previous, value); }
                catch (Exception ex) { Log.Warning(ex, "Error in OnStateChanged handler"); }
            }
        }

        /// <summary>Display name of the detected scanner model.</summary>
        public string ScannerName { get; private set; }

        public Gemalto()
        {
            CreateComObjects();
        }

        /// <summary>
        /// Creates fresh COM object instances.
        /// </summary>
        private void CreateComObjects()
        {
            _sLib = new NetScanW.SLibExClass();
            _sLibEx = new NetScanWex.SLibExClass();

            _image = new NetScanW.CImageClass();
            _imageEx = new NetScanWex.CImageClass();

            _idData = new NetScanW.IdDataClass();
            _idDataEx = new NetScanWex.IdDataClass();

            _ocrLib = new NetScanW.COcrClass();
        }

        public bool InitSDK()
        {
            State = ScannerState.Connecting;

            try
            {
                _sLibEx.DefaultScanner = AcuantConstants.CSSN_RTE9K;

                // Initializing Scanner Library
                int result = _sLib.InitLibrary(license);
                if (result < 0 && result != -13)
                {
                    Log.Error(AcuantCore.GetScannerClassError(result));
                    State = ScannerState.Error;
                    return false;
                }

                // Initializing Image Library
                result = _image.InitLibrary(license);

                // Initializing Id data library
                result = _idData.InitLibrary(license);

                // Hebrew SDK requires NetScanW.COcrClass to be intialized too
                result = _ocrLib.InitLibrary(license);

                // Auto grab mode    
                _sLibEx.GrabMode = 0;

                string scannerName = AcuantConstants.GetScannerNameByType(_sLib.ScannerType);
                ScannerName = scannerName;
                Log.Information("Scanner Name: " + scannerName);
                Log.Information("SDK Version: " + _sLib.Version);
                Log.Information("Waiting for document...\n");

                State = ScannerState.Connected;
                return true;
            }
            catch (COMException ex)
            {
                Log.Error(ex, "COM error during scanner SDK initialization");
                State = ScannerState.Error;
                return false;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Unexpected error during scanner SDK initialization");
                State = ScannerState.Error;
                return false;
            }
        }

        /// <summary>
        /// Mark the scanner as disconnected without releasing COM resources or killing SnapServer.
        /// This allows the SDK to auto-recover when the USB device is re-plugged,
        /// preserving PaperInTray detection and auto-scan capability.
        /// </summary>
        public void MarkDisconnected()
        {
            Log.Information("Scanner marked as disconnected (soft — COM objects preserved)");
            State = ScannerState.Disconnected;
        }

        /// <summary>
        /// Release COM objects and reset scanner state.
        /// Safe to call even if already released.
        /// Kills the SnapServer process first to release the USB device.
        /// </summary>
        public void ReleaseResources()
        {
            Log.Information("Releasing scanner COM resources...");

            // KillSnapServer must be called FIRST — it runs a background process
            // that holds the USB device open. Without killing it, new COM objects
            // cannot reattach to the scanner after USB reconnect.
            try { _sLibEx?.KillSnapServer(); } catch { /* ignore */ }

            // Wait briefly for the snap server process to fully terminate
            System.Threading.Thread.Sleep(500);

            SafeReleaseCom(ref _ocrLib);
            SafeReleaseCom(ref _idDataEx);
            SafeReleaseCom(ref _idData);
            SafeReleaseCom(ref _imageEx);
            SafeReleaseCom(ref _image);
            SafeReleaseCom(ref _sLibEx);
            SafeReleaseCom(ref _sLib);

            scanning = false;
            processing = false;
            ScannerName = null;
            _lastImageBase64 = null;
            State = ScannerState.Disconnected;

            Log.Information("Scanner COM resources released");
        }

        /// <summary>
        /// Re-create COM objects and re-initialize the SDK after a disconnect.
        /// This is the correct way to recover — the Acuant COM SDK works as a
        /// process-level singleton, so we must: kill snap server → release COM →
        /// recreate COM → reinit SDK library.
        /// Returns true if scanner is now ready.
        /// </summary>
        public bool Reinitialize()
        {
            State = ScannerState.Reconnecting;
            Log.Information("Attempting scanner reinitialization...");

            try
            {
                // Step 1: Release everything (including KillSnapServer)
                ReleaseResources();

                // Step 2: Extra wait for USB device to be released by the OS
                System.Threading.Thread.Sleep(1000);

                // Step 3: Recreate COM objects
                CreateComObjects();

                // Step 4: Reinitialize the SDK
                bool result = InitSDK();

                if (result && IsScannerReady)
                {
                    Log.Information("Scanner reinitialized successfully. Scanner={Scanner}", ScannerName);
                    return true;
                }

                Log.Warning("Scanner reinitialization completed but scanner is not ready (IsScannerValid={Valid})",
                    IsScannerReady);
                State = ScannerState.Disconnected;
                return false;
            }
            catch (COMException ex)
            {
                Log.Warning("Scanner reinitialization failed (COM): {Message}", ex.Message);
                State = ScannerState.Disconnected;
                return false;
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Scanner reinitialization failed");
                State = ScannerState.Disconnected;
                return false;
            }
        }

        /// <summary>
        /// Check whether the scanner USB device is physically connected.
        /// Pure health check — does NOT change state. Caller is responsible for
        /// calling InitSDK() to re-establish the scanner session after reconnect.
        /// The Acuant SDK returns IsScannerValid == 0 when USB is unplugged
        /// (it does NOT throw COMException — it gracefully returns 0).
        /// </summary>
        public bool CheckConnection()
        {
            try
            {
                if (_sLib == null) return false;

                int valid = _sLib.IsScannerValid;
                if (valid != 1)
                {
                    Log.Debug("IsScannerValid returned {Value} — scanner not connected", valid);
                    return false;
                }
                return true;
            }
            catch (COMException ex)
            {
                Log.Warning(ex, "COM error checking scanner connection");
                return false;
            }
            catch (InvalidComObjectException)
            {
                return false;
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Unexpected error checking scanner connection");
                return false;
            }
        }

        /// <summary>
        /// Polls for a document in the scanner tray. Returns true if scanner is healthy.
        /// Returns false if the scanner is detected as disconnected (IsScannerValid != 1).
        /// May also throw ScannerDisconnectedException on hard COM failures.
        /// </summary>
        public bool CheckLicenseInsertTick()
        {
            try
            {
                if (_sLib == null) return false;

                // ── Active health check every poll cycle ──
                // The Acuant SDK does NOT throw when USB is pulled — 
                // IsScannerValid silently returns 0. We must check actively.
                int scannerValid = _sLib.IsScannerValid;
                if (scannerValid != 1)
                {
                    Log.Warning("Scanner health check failed: IsScannerValid={Value}. USB may be disconnected.",
                        scannerValid);
                    return false; // Signal disconnect to caller
                }

                if (_sLib.PaperInTray == 1)
                {
                    ScanAndProcess();
                }
                return true;
            }
            catch (COMException ex)
            {
                Log.Error(ex, "COM error during scanner poll — scanner may be disconnected");
                throw new ScannerDisconnectedException("Scanner USB disconnected (COM error)", ex);
            }
            catch (InvalidComObjectException ex)
            {
                Log.Error(ex, "Invalid COM object — scanner handle is stale");
                throw new ScannerDisconnectedException("Scanner USB disconnected (stale COM handle)", ex);
            }
        }

        private void ScanAndProcess()
        {
            scanning = true;
            Log.Information("Scanning document, please wait...\n");
            try
            {
                ScanDocument();
            }
            catch (Exception ex)
            {
                scanning = false;
                Log.Error(ex, "Error during document scan");
                throw; // Propagate to caller for disconnect detection
            }
            scanning = false;

            processing = true;
            ScanResult result = null;
            try
            {
                result = ExtractData();
            }
            catch (Exception ex)
            {
                processing = false;
                Log.Error(ex, "Error during data extraction");
                return;
            }
            Log.Information("Scanning finished.\n");
            processing = false;

            // Notify the agent socket client via event
            if (result != null)
            {
                OnScanCompleted?.Invoke(result);
            }

            Log.Information("Waiting for document...\n");
        }

        /// <summary>
        /// Execute a scan command triggered by the backend (via agent:execute-scan).
        /// Synchronously scans and returns the result.
        /// </summary>
        public ScanResult ExecuteScanCommand()
        {
            if (State != ScannerState.Connected)
            {
                Log.Warning("Scan command received but scanner is in {State} state", State);
                return new ScanResult { error = true };
            }

            if (scanning || processing)
            {
                return new ScanResult { error = true };
            }

            try
            {
                scanning = true;
                Log.Information("Executing scan command from backend...");
                ScanDocument();
                scanning = false;

                processing = true;
                ScanResult result = ExtractData();
                processing = false;

                Log.Information("Scan command execution complete.");
                return result ?? new ScanResult { error = true };
            }
            catch (COMException ex)
            {
                scanning = false;
                processing = false;
                Log.Error(ex, "COM error executing scan command — scanner may be disconnected");
                State = ScannerState.Disconnected;
                return new ScanResult { error = true };
            }
            catch (InvalidComObjectException ex)
            {
                scanning = false;
                processing = false;
                Log.Error(ex, "Invalid COM object during scan command — scanner handle is stale");
                State = ScannerState.Disconnected;
                return new ScanResult { error = true };
            }
            catch (Exception ex)
            {
                scanning = false;
                processing = false;
                Log.Error(ex, "Unexpected error executing scan command");
                return new ScanResult { error = true };
            }
        }

        private void ScanDocument()
        {
            int result;

            if (_sLib.IsScannerValid == 1)
            {
                _sLib.Resolution = 300;
                _sLib.ScanHeight = -1;
                _sLib.ScanWidth = -1;

                result = _sLib.ScanToFileEx("");
                if (result < 0)
                {
                    Log.Error(AcuantCore.GetScannerClassError(result));
                    return;
                }

                result = _imageEx.GetImageBufferData("JPG", out imagebuffer);
                if (result < 0)
                {
                    Log.Error(AcuantCore.GetImageClassError(result));
                    return;
                }

                _lastImageBase64 = AcuantUtilities.GetImageFromBuffer(imagebuffer);
            }
            else
            {
                Log.Information("Scanner not valid. Please check the connection to the scanner.");
            }
        }

        public void KillSnapServer()
        {
            try
            {
                _sLibEx?.KillSnapServer();
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Error during KillSnapServer");
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            State = ScannerState.Disconnected;
            ReleaseResources();
        }

        private static void SafeReleaseCom<T>(ref T obj) where T : class
        {
            if (obj == null) return;
            try
            {
                if (Marshal.IsComObject(obj))
                {
                    Marshal.ReleaseComObject(obj);
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Error releasing COM object of type {Type}", typeof(T).Name);
            }
            obj = null;
        }

        private ScanResult ExtractData()
        {
            int stateID = -1;
            ScanResult scanResult = new ScanResult();

            _idDataEx.WideCharacters = 1;
            _idDataEx.RegionSet(AcuantUtilities.GetRegionIntValue(region));

            stateID = _idData.AutoDetectState(string.Empty);
            if (stateID < 0)
            {
                scanResult.error = true;
                Log.Information("Cannot detect auto state");
                return scanResult;
            }

            int result = _idData.ProcState(string.Empty, stateID);
            if (result < 0)
            {
                scanResult.error = true;
                Log.Error(AcuantCore.GetIdDataClassError(result));
                return scanResult;
            }

            _idData.RefreshData();

            scanResult.personId = String.Concat(_idData.Id.Where(c => !Char.IsWhiteSpace(c)));
            scanResult.personId = ExtractEnglishCharsFromString(scanResult.personId);
            scanResult.firstName = _idData.NameFirst;
            scanResult.lastName = _idData.NameLast;
            scanResult.identifyNumber = _idData.Text1;
            scanResult.image = _lastImageBase64 ?? string.Empty;

            if (string.IsNullOrEmpty(scanResult.personId) && string.IsNullOrEmpty(scanResult.identifyNumber))
            {
                scanResult.error = true;
                Log.Information("Cannot extract ID and identify number");
                return scanResult;
            }



            Log.Information("Scan result:" + "\n" +
                             "First name: " + scanResult.firstName + "\n" +
                             "Last name: " + scanResult.lastName + "\n" +
                             "Person ID: " + scanResult.personId + "\n" +
                             "Identity Number: " + scanResult.identifyNumber);

            return scanResult;
        }



        private string ExtractEnglishCharsFromString(string input)
        {
            StringBuilder sb = new StringBuilder();

            foreach (char c in input)
            {
                if ((c < 'A' || (c > 'Z' && c < 'a') || c > 'z'))
                {
                    sb.Append(c);
                }
            }

            return sb.ToString();
        }
    }
}
