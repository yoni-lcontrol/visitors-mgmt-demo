using System;
using System.Collections.Generic;
using System.Threading;

namespace ScannerService
{
    /// <summary>
    /// Fake scanner device for unit testing.
    /// Simulates scanner hardware without COM dependencies.
    /// </summary>
    public class FakeScannerDevice : IScannerDevice
    {
        private ScannerState _state = ScannerState.Disconnected;
        private bool _disposed;
        private int _initCallCount;
        private int _releaseCallCount;
        private int _checkConnectionCallCount;
        private int _checkTickCallCount;
        private int _executeScanCallCount;
        private int _reinitializeCallCount;

        /// <summary>Controls whether InitSDK() succeeds.</summary>
        public bool InitShouldSucceed { get; set; } = true;

        /// <summary>Controls whether InitSDK() throws an exception.</summary>
        public Exception InitException { get; set; }

        /// <summary>Controls whether CheckConnection() returns true.</summary>
        public bool IsPhysicallyConnected { get; set; } = true;

        /// <summary>Controls whether CheckLicenseInsertTick returns false (simulates USB disconnect).</summary>
        public bool SimulateDisconnectOnTick { get; set; }

        /// <summary>Controls whether Reinitialize() succeeds.</summary>
        public bool ReinitializeShouldSucceed { get; set; } = true;

        /// <summary>Number of times Reinitialize was called.</summary>
        public int ReinitializeCallCount => _reinitializeCallCount;

        /// <summary>Controls whether CheckLicenseInsertTick triggers a scan.</summary>
        public bool HasDocumentInTray { get; set; }

        /// <summary>The scan result to return from ExecuteScanCommand.</summary>
        public ScanResult NextScanResult { get; set; }

        /// <summary>Number of times InitSDK was called.</summary>
        public int InitCallCount => _initCallCount;

        /// <summary>Number of times ReleaseResources was called.</summary>
        public int ReleaseCallCount => _releaseCallCount;

        /// <summary>Number of times CheckConnection was called.</summary>
        public int CheckConnectionCallCount => _checkConnectionCallCount;

        /// <summary>Number of times CheckLicenseInsertTick was called.</summary>
        public int CheckTickCallCount => _checkTickCallCount;

        /// <summary>Number of times ExecuteScanCommand was called.</summary>
        public int ExecuteScanCallCount => _executeScanCallCount;

        /// <summary>Whether Dispose has been called.</summary>
        public bool IsDisposed => _disposed;

        /// <summary>Recorded state transitions.</summary>
        public List<Tuple<ScannerState, ScannerState>> StateTransitions { get; } = new List<Tuple<ScannerState, ScannerState>>();

        public bool IsScannerReady => _state == ScannerState.Connected && IsPhysicallyConnected;

        public ScannerState State => _state;

        public string ScannerName { get; set; } = "FakeScanner-RTE9K";

        public event Action<ScanResult> OnScanCompleted;
        public event Action OnScanStarted;
        public event Action<ScannerState, ScannerState> OnStateChanged;

        public bool InitSDK()
        {
            Interlocked.Increment(ref _initCallCount);

            if (InitException != null) throw InitException;

            SetState(ScannerState.Connecting);

            if (InitShouldSucceed && IsPhysicallyConnected)
            {
                SetState(ScannerState.Connected);
                return true;
            }

            SetState(ScannerState.Error);
            return false;
        }

        public void ReleaseResources()
        {
            Interlocked.Increment(ref _releaseCallCount);
            SetState(ScannerState.Disconnected);
        }

        public void MarkDisconnected()
        {
            SetState(ScannerState.Disconnected);
        }

        public bool CheckConnection()
        {
            Interlocked.Increment(ref _checkConnectionCallCount);
            return IsPhysicallyConnected;
        }

        public bool Reinitialize()
        {
            Interlocked.Increment(ref _reinitializeCallCount);

            if (ReinitializeShouldSucceed && IsPhysicallyConnected)
            {
                SetState(ScannerState.Connected);
                return true;
            }

            SetState(ScannerState.Error);
            return false;
        }

        public bool CheckLicenseInsertTick()
        {
            Interlocked.Increment(ref _checkTickCallCount);

            if (SimulateDisconnectOnTick)
            {
                // Return false = scanner disconnected (match Gemalto SDK behavior)
                // Don't change state here — the lifecycle manager handles state transitions
                return false;
            }

            if (HasDocumentInTray)
            {
                var result = NextScanResult ?? new ScanResult
                {
                    personId = "FAKE123",
                    firstName = "Test",
                    lastName = "User",
                    identifyNumber = "123456789",
                };
                OnScanCompleted?.Invoke(result);
                HasDocumentInTray = false; // Only fire once
            }

            return true;
        }

        public ScanResult ExecuteScanCommand()
        {
            Interlocked.Increment(ref _executeScanCallCount);

            if (_state != ScannerState.Connected)
            {
                return new ScanResult { error = true };
            }

            return NextScanResult ?? new ScanResult
            {
                personId = "FAKE123",
                firstName = "Test",
                lastName = "User",
                identifyNumber = "123456789",
            };
        }

        public void Dispose()
        {
            _disposed = true;
            SetState(ScannerState.Disconnected);
        }

        /// <summary>Force a state transition (for testing state change notifications).</summary>
        public void ForceState(ScannerState newState)
        {
            SetState(newState);
        }

        private void SetState(ScannerState newState)
        {
            if (_state == newState) return;
            var previous = _state;
            _state = newState;
            StateTransitions.Add(Tuple.Create(previous, newState));
            OnStateChanged?.Invoke(previous, newState);
        }
    }
}
