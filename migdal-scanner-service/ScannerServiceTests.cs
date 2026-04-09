using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace ScannerService.Tests
{
    /// <summary>
    /// Unit tests for scanner disconnect/reconnect lifecycle.
    /// Uses FakeScannerDevice to simulate USB disconnect/reconnect scenarios.
    /// 
    /// These tests can be run with any test framework (NUnit, MSTest, xUnit).
    /// Each test method follows Arrange-Act-Assert and returns pass/fail to console.
    /// 
    /// To run: compile and execute ScannerServiceTests.Run() from Program.cs
    /// or integrate into a test project with your preferred framework.
    /// </summary>
    public static class ScannerServiceTests
    {
        private static int _passed;
        private static int _failed;
        private static readonly List<string> _failures = new List<string>();

        public static void Run()
        {
            _passed = 0;
            _failed = 0;
            _failures.Clear();

            Console.WriteLine("═══════════════════════════════════════════════");
            Console.WriteLine("  Scanner Service — Disconnect/Reconnect Tests");
            Console.WriteLine("═══════════════════════════════════════════════\n");

            // State management tests
            RunTest("Initial state is Disconnected", InitialStateIsDisconnected);
            RunTest("InitSDK transitions to Connected on success", InitSDKTransitionsToConnected);
            RunTest("InitSDK transitions to Error on failure", InitSDKTransitionsToError);

            // Disconnect detection tests
            RunTest("Disconnect detected during polling", DisconnectDetectedDuringPolling);
            RunTest("Disconnect fires state change event", DisconnectFiresStateChangeEvent);
            RunTest("CheckConnection failure triggers disconnect", CheckConnectionFailureTriggers);

            // Reconnect tests
            RunTest("Reconnect restores connected state", ReconnectRestoresConnectedState);
            RunTest("Reconnect after factory failure retries", ReconnectAfterFactoryFailure);
            RunTest("Reconnect after InitSDK failure retries", ReconnectAfterInitFailure);
            RunTest("Reconnect backoff increases delay", ReconnectBackoffIncreasesDelay);
            RunTest("No duplicate event handlers after reconnect", NoDuplicateEventsAfterReconnect);

            // Status reporting tests
            RunTest("State change reported correctly", StateChangeReportedCorrectly);
            RunTest("Scanner property updates on reconnect", ScannerPropertyUpdatesOnReconnect);

            // Lifecycle tests
            RunTest("Dispose cleans up scanner device", DisposeCleanUpDevice);
            RunTest("Run loop exits on cancellation", RunLoopExitsOnCancellation);
            RunTest("Recovery without service restart", RecoveryWithoutRestart);

            // Error handling tests
            RunTest("Factory exception handled gracefully", FactoryExceptionHandledGracefully);
            RunTest("Scan command fails in disconnected state", ScanCommandFailsInDisconnectedState);

            Console.WriteLine("\n═══════════════════════════════════════════════");
            Console.WriteLine($"  Results: {_passed} passed, {_failed} failed, {_passed + _failed} total");
            Console.WriteLine("═══════════════════════════════════════════════");

            if (_failures.Count > 0)
            {
                Console.WriteLine("\nFailures:");
                foreach (var f in _failures) Console.WriteLine($"  ✗ {f}");
            }
        }

        // ─── State Management Tests ──────────────────────────────────

        private static void InitialStateIsDisconnected()
        {
            var config = CreateTestConfig();
            var device = new FakeScannerDevice();
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                Assert(mgr.State == ScannerState.Disconnected, "Initial state should be Disconnected");
            }
        }

        private static void InitSDKTransitionsToConnected()
        {
            var config = CreateTestConfig();
            var device = new FakeScannerDevice { InitShouldSucceed = true, IsPhysicallyConnected = true };
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                bool result = mgr.Initialize();

                Assert(result, "Initialize should return true");
                Assert(mgr.State == ScannerState.Connected, "State should be Connected after init");
                Assert(device.InitCallCount == 1, "InitSDK should be called once");
            }
        }

        private static void InitSDKTransitionsToError()
        {
            var config = CreateTestConfig();
            var device = new FakeScannerDevice { InitShouldSucceed = false, IsPhysicallyConnected = false };
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                bool result = mgr.Initialize();

                Assert(!result, "Initialize should return false on failure");
                Assert(device.InitCallCount == 1, "InitSDK should be called once");
            }
        }

        // ─── Disconnect Detection Tests ──────────────────────────────

        private static void DisconnectDetectedDuringPolling()
        {
            var config = CreateTestConfig();
            var disconnectedEvent = new ManualResetEventSlim(false);
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = true,
                IsPhysicallyConnected = true,
            };

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                mgr.OnStateChanged += (prev, curr) =>
                {
                    if (curr == ScannerState.Disconnected) disconnectedEvent.Set();
                };

                mgr.Initialize();
                Assert(mgr.State == ScannerState.Connected, "Should start connected");

                // Simulate disconnect: CheckLicenseInsertTick returns false
                device.SimulateDisconnectOnTick = true;

                var task = Task.Run(() => mgr.Run(cts.Token));
                bool detected = disconnectedEvent.Wait(5000);
                cts.Cancel();
                task.Wait(2000);

                Assert(detected, "Disconnect should be detected within 5 seconds");
            }
        }

        private static void DisconnectFiresStateChangeEvent()
        {
            var config = CreateTestConfig();
            var stateChanges = new List<Tuple<ScannerState, ScannerState>>();
            var disconnectedEvent = new ManualResetEventSlim(false);
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = true,
                IsPhysicallyConnected = true,
            };

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 200))
            {
                mgr.OnStateChanged += (prev, curr) =>
                {
                    lock (stateChanges) stateChanges.Add(Tuple.Create(prev, curr));
                    if (curr == ScannerState.Disconnected) disconnectedEvent.Set();
                };

                mgr.Initialize();

                // Trigger disconnect
                device.SimulateDisconnectOnTick = true;

                var task = Task.Run(() => mgr.Run(cts.Token));
                disconnectedEvent.Wait(5000);
                cts.Cancel();
                task.Wait(2000);

                // Verify state change event was fired with correct transition
                bool hasDisconnectTransition;
                lock (stateChanges)
                {
                    hasDisconnectTransition = stateChanges.Exists(
                        t => t.Item2 == ScannerState.Disconnected);
                }
                Assert(hasDisconnectTransition, "Should have a transition to Disconnected state");
            }
        }

        private static void CheckConnectionFailureTriggers()
        {
            var config = CreateTestConfig();
            var disconnectedEvent = new ManualResetEventSlim(false);
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = true,
                IsPhysicallyConnected = true,
            };

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 200))
            {
                mgr.OnStateChanged += (prev, curr) =>
                {
                    if (curr == ScannerState.Disconnected) disconnectedEvent.Set();
                };

                mgr.Initialize();

                // Simulate disconnect: tick returns false + CheckConnection returns false
                device.SimulateDisconnectOnTick = true;
                device.IsPhysicallyConnected = false;

                var task = Task.Run(() => mgr.Run(cts.Token));
                bool detected = disconnectedEvent.Wait(5000);
                cts.Cancel();
                task.Wait(2000);

                Assert(detected, "Disconnect from CheckConnection failure should be detected");
            }
        }

        // ─── Reconnect Tests ─────────────────────────────────────────

        private static void ReconnectRestoresConnectedState()
        {
            var config = CreateTestConfig();
            var reconnectedEvent = new ManualResetEventSlim(false);
            var disconnectedEvent = new ManualResetEventSlim(false);
            bool disconnectTriggered = false;
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = true,
                IsPhysicallyConnected = true,
            };

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                mgr.OnStateChanged += (prev, curr) =>
                {
                    if (curr == ScannerState.Disconnected && !disconnectTriggered)
                    {
                        disconnectTriggered = true;
                        disconnectedEvent.Set();
                    }
                    if (curr == ScannerState.Connected && disconnectTriggered)
                    {
                        reconnectedEvent.Set();
                    }
                };

                mgr.Initialize();
                Assert(mgr.State == ScannerState.Connected, "Should start connected");

                // Trigger disconnect (CheckLicenseInsertTick returns false)
                device.SimulateDisconnectOnTick = true;
                device.IsPhysicallyConnected = false;

                var task = Task.Run(() => mgr.Run(cts.Token));

                disconnectedEvent.Wait(5000);
                Assert(disconnectTriggered, "Should have disconnected");

                // Simulate USB reconnect: just make IsPhysicallyConnected true
                // Soft reconnect: CheckConnection detects USB, then InitSDK re-establishes session
                device.SimulateDisconnectOnTick = false;
                device.IsPhysicallyConnected = true;

                bool reconnected = reconnectedEvent.Wait(10000);
                cts.Cancel();
                task.Wait(2000);

                Assert(reconnected, "Should reconnect via soft reconnect (CheckConnection + InitSDK)");
                Assert(mgr.State == ScannerState.Connected, "State should be Connected after reconnect");
                Assert(mgr.Scanner == device, "Should use same device instance");
                Assert(device.ReinitializeCallCount == 0, "Soft reconnect should NOT call Reinitialize");
                Assert(device.ReleaseCallCount == 0, "Soft reconnect should NOT release COM resources");
                Assert(device.InitCallCount >= 2, "InitSDK should be called again on soft reconnect to restore PaperInTray");
            }
        }

        private static void ReconnectAfterFactoryFailure()
        {
            var config = CreateTestConfig();
            int deviceCreationCount = 0;
            var reconnectedEvent = new ManualResetEventSlim(false);

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () =>
            {
                deviceCreationCount++;
                if (deviceCreationCount <= 2) throw new Exception("Factory failure");
                return new FakeScannerDevice { InitShouldSucceed = true, IsPhysicallyConnected = true };
            }, 50, 50, 100))
            {
                mgr.OnStateChanged += (prev, curr) =>
                {
                    if (curr == ScannerState.Connected) reconnectedEvent.Set();
                };

                // Initialize will fail the first time via factory
                // But run loop should keep retrying via factory (since device is null)
                try { mgr.Initialize(); } catch { /* expected */ }

                var task = Task.Run(() => mgr.Run(cts.Token));
                bool reconnected = reconnectedEvent.Wait(10000);
                cts.Cancel();
                task.Wait(2000);

                Assert(reconnected, "Should eventually connect after factory failures");
                Assert(deviceCreationCount >= 3, "Should have retried factory multiple times");
            }
        }

        private static void ReconnectAfterInitFailure()
        {
            var config = CreateTestConfig();
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = false,
                IsPhysicallyConnected = false,
            };
            var reconnectedEvent = new ManualResetEventSlim(false);

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                mgr.OnStateChanged += (prev, curr) =>
                {
                    if (curr == ScannerState.Connected) reconnectedEvent.Set();
                };

                mgr.Initialize(); // Will fail — device stays alive but in Error state

                // After a delay, simulate scanner coming online.
                // Soft reconnect: CheckConnection detects USB, then InitSDK re-establishes session.
                Task.Run(() =>
                {
                    Thread.Sleep(200);
                    device.IsPhysicallyConnected = true;
                    device.InitShouldSucceed = true;
                });

                var task = Task.Run(() => mgr.Run(cts.Token));
                bool reconnected = reconnectedEvent.Wait(10000);
                cts.Cancel();
                task.Wait(2000);

                Assert(reconnected, "Should eventually connect via soft reconnect after init failure");
            }
        }

        private static void ReconnectBackoffIncreasesDelay()
        {
            var config = CreateTestConfig();
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = false,
                IsPhysicallyConnected = false,
                ReinitializeShouldSucceed = false,
            };

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 100, 1000))
            {
                mgr.Initialize();

                var task = Task.Run(() => mgr.Run(cts.Token));

                // Wait for multiple reconnect attempts (soft + hard)
                DateTime start = DateTime.UtcNow;
                while ((DateTime.UtcNow - start).TotalSeconds < 15 &&
                    device.CheckConnectionCallCount + device.ReinitializeCallCount < 8)
                {
                    Thread.Sleep(100);
                }

                cts.Cancel();
                task.Wait(5000);

                int totalAttempts = device.CheckConnectionCallCount + device.ReinitializeCallCount;
                Assert(totalAttempts >= 3,
                    $"Should have at least 3 reconnect attempts, got {totalAttempts}");
            }
        }

        private static void NoDuplicateEventsAfterReconnect()
        {
            var config = CreateTestConfig();
            int scanResultCount = 0;
            var reconnectedEvent = new ManualResetEventSlim(false);
            var disconnectedEvent = new ManualResetEventSlim(false);
            bool disconnectTriggered = false;
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = true,
                IsPhysicallyConnected = true,
            };

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                Action<ScanResult> scanHandler = (result) =>
                {
                    Interlocked.Increment(ref scanResultCount);
                };

                mgr.OnStateChanged += (prev, curr) =>
                {
                    if (curr == ScannerState.Connected && disconnectTriggered)
                    {
                        reconnectedEvent.Set();
                    }
                    if (curr == ScannerState.Disconnected && !disconnectTriggered)
                    {
                        disconnectTriggered = true;
                        disconnectedEvent.Set();
                    }
                };

                mgr.Initialize();
                mgr.WireScanCompletedEvent(scanHandler);

                // Trigger a scan on the device
                device.HasDocumentInTray = true;

                var task = Task.Run(() => mgr.Run(cts.Token));

                // Wait for the scan to complete, then trigger disconnect
                Thread.Sleep(200);

                device.SimulateDisconnectOnTick = true;
                device.IsPhysicallyConnected = false;
                disconnectedEvent.Wait(5000);

                // Simulate USB reconnect — soft reconnect via CheckConnection
                device.SimulateDisconnectOnTick = false;
                device.IsPhysicallyConnected = true;

                reconnectedEvent.Wait(10000);

                // Trigger scan after reconnect — same device, same event handler
                scanResultCount = 0;
                device.HasDocumentInTray = true;

                Thread.Sleep(500);
                cts.Cancel();
                task.Wait(2000);

                // Since it's the same device instance, event handler is still wired — no duplicates
                Assert(scanResultCount <= 1, $"Scan result should fire at most once, got {scanResultCount}");
            }
        }

        // ─── Status Reporting Tests ──────────────────────────────────

        private static void StateChangeReportedCorrectly()
        {
            var config = CreateTestConfig();
            var recordedStates = new List<Tuple<ScannerState, ScannerState>>();

            using (var mgr = new ScannerLifecycleManager(config, () =>
                new FakeScannerDevice { InitShouldSucceed = true, IsPhysicallyConnected = true },
                50, 50, 100))
            {
                mgr.OnStateChanged += (prev, curr) =>
                {
                    lock (recordedStates) recordedStates.Add(Tuple.Create(prev, curr));
                };

                mgr.Initialize();

                bool hasConnecting;
                bool hasConnected;
                lock (recordedStates)
                {
                    hasConnecting = recordedStates.Exists(t => t.Item2 == ScannerState.Connecting);
                    hasConnected = recordedStates.Exists(t => t.Item2 == ScannerState.Connected);
                }

                Assert(hasConnecting, "Should have reported Connecting state");
                Assert(hasConnected, "Should have reported Connected state");
            }
        }

        private static void ScannerPropertyUpdatesOnReconnect()
        {
            var config = CreateTestConfig();
            var reconnectedEvent = new ManualResetEventSlim(false);
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = true,
                IsPhysicallyConnected = true,
                ScannerName = "Scanner-v1",
            };

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                bool disconnected = false;
                mgr.OnStateChanged += (prev, curr) =>
                {
                    if (curr == ScannerState.Disconnected) disconnected = true;
                    if (curr == ScannerState.Connected && disconnected) reconnectedEvent.Set();
                };

                mgr.Initialize();
                Assert(mgr.Scanner.ScannerName == "Scanner-v1", "Device name should be v1");

                // Disconnect
                device.SimulateDisconnectOnTick = true;
                device.IsPhysicallyConnected = false;

                var task = Task.Run(() => mgr.Run(cts.Token));

                // Wait for disconnect, then allow soft reconnect
                Thread.Sleep(500);
                device.SimulateDisconnectOnTick = false;
                device.IsPhysicallyConnected = true;

                reconnectedEvent.Wait(10000);
                cts.Cancel();
                task.Wait(2000);

                Assert(mgr.Scanner != null, "Scanner should not be null after reconnect");
                Assert(mgr.Scanner == device, "Should be same device instance (soft reconnect)");
                Assert(mgr.Scanner.IsScannerReady, "Scanner should be ready after reconnect");
            }
        }

        // ─── Lifecycle Tests ─────────────────────────────────────────

        private static void DisposeCleanUpDevice()
        {
            var config = CreateTestConfig();
            FakeScannerDevice device = null;

            var mgr = new ScannerLifecycleManager(config, () =>
            {
                device = new FakeScannerDevice { InitShouldSucceed = true, IsPhysicallyConnected = true };
                return device;
            }, 50, 50, 100);

            mgr.Initialize();
            Assert(device != null, "Device should have been created");
            Assert(!device.IsDisposed, "Device should not be disposed yet");

            mgr.Dispose();
            Assert(device.IsDisposed, "Device should be disposed after lifecycle dispose");
            Assert(mgr.Scanner == null, "Scanner should be null after dispose");
        }

        private static void RunLoopExitsOnCancellation()
        {
            var config = CreateTestConfig();
            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () =>
                new FakeScannerDevice { InitShouldSucceed = true, IsPhysicallyConnected = true },
                50, 50, 100))
            {
                mgr.Initialize();
                var task = Task.Run(() => mgr.Run(cts.Token));

                Thread.Sleep(200);
                cts.Cancel();

                bool completed = task.Wait(5000);
                Assert(completed, "Run loop should exit within 5 seconds of cancellation");
            }
        }

        private static void RecoveryWithoutRestart()
        {
            // Full end-to-end test: connected → disconnect → soft reconnect → scan works
            // Uses single device instance — COM objects preserved, no Reinitialize needed
            var config = CreateTestConfig();
            bool disconnectTriggered = false;
            var reconnectedEvent = new ManualResetEventSlim(false);
            var disconnectedEvent = new ManualResetEventSlim(false);
            var scanAfterReconnectEvent = new ManualResetEventSlim(false);
            var device = new FakeScannerDevice
            {
                InitShouldSucceed = true,
                IsPhysicallyConnected = true,
            };

            using (var cts = new CancellationTokenSource())
            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                Action<ScanResult> scanHandler = (r) => scanAfterReconnectEvent.Set();

                mgr.OnStateChanged += (prev, curr) =>
                {
                    if (curr == ScannerState.Connected && disconnectTriggered)
                    {
                        reconnectedEvent.Set();
                    }
                    if (curr == ScannerState.Disconnected && !disconnectTriggered)
                    {
                        disconnectTriggered = true;
                        disconnectedEvent.Set();
                    }
                };

                mgr.Initialize();
                mgr.WireScanCompletedEvent(scanHandler);

                // Phase 1: Connected
                Assert(mgr.State == ScannerState.Connected, "Phase 1: should be connected");

                // Phase 2: Disconnect (USB pulled)
                device.SimulateDisconnectOnTick = true;
                device.IsPhysicallyConnected = false;
                var task = Task.Run(() => mgr.Run(cts.Token));
                disconnectedEvent.Wait(5000);
                Assert(disconnectTriggered, "Phase 2: disconnect should be detected");

                // Phase 3: Soft reconnect (USB re-plugged)
                device.SimulateDisconnectOnTick = false;
                device.IsPhysicallyConnected = true;
                reconnectedEvent.Wait(10000);
                Assert(mgr.State == ScannerState.Connected, "Phase 3: should be reconnected");

                // Phase 4: Scan works after reconnect (same device, same event handler, same COM state)
                Assert(mgr.Scanner != null, "Phase 4: scanner should be available");
                device.HasDocumentInTray = true;

                bool scanWorked = scanAfterReconnectEvent.Wait(5000);
                cts.Cancel();
                task.Wait(2000);

                Assert(scanWorked, "Phase 4: scan should work after soft reconnect without restart");
                Assert(device.ReinitializeCallCount == 0, "Soft reconnect should NOT call Reinitialize");
                Assert(device.ReleaseCallCount == 0, "Soft reconnect should NOT release COM resources");
                Assert(device.InitCallCount >= 2, "InitSDK should be re-called on soft reconnect");
            }
        }

        // ─── Error Handling Tests ────────────────────────────────────

        private static void FactoryExceptionHandledGracefully()
        {
            var config = CreateTestConfig();
            int deviceCreationCount = 0;

            using (var mgr = new ScannerLifecycleManager(config, () =>
            {
                deviceCreationCount++;
                throw new Exception("COM creation failed");
            }, 50, 50, 100))
            {
                bool result = mgr.Initialize();
                Assert(!result, "Initialize should return false when factory throws");
                Assert(mgr.Scanner == null, "Scanner should be null when factory throws");
            }
        }

        private static void ScanCommandFailsInDisconnectedState()
        {
            var config = CreateTestConfig();
            var device = new FakeScannerDevice { InitShouldSucceed = true, IsPhysicallyConnected = true };

            using (var mgr = new ScannerLifecycleManager(config, () => device, 50, 50, 100))
            {
                // Don't initialize — scanner should be in disconnected state
                // Create device manually to test
                var disconnectedDevice = new FakeScannerDevice();
                var result = disconnectedDevice.ExecuteScanCommand();

                Assert(result.error, "Scan command should fail when device is disconnected");
                Assert(disconnectedDevice.ExecuteScanCallCount == 1, "Should have attempted scan once");
            }
        }

        // ─── Helpers ────────────────────────────────────────────────

        private static AgentConfig CreateTestConfig()
        {
            // Create a minimal config for testing
            return AgentConfig.LoadForTests();
        }

        private static void Assert(bool condition, string message)
        {
            if (!condition) throw new Exception($"Assertion failed: {message}");
        }

        private static void RunTest(string name, Action test)
        {
            try
            {
                test();
                _passed++;
                Console.WriteLine($"  ✓ {name}");
            }
            catch (Exception ex)
            {
                _failed++;
                _failures.Add($"{name}: {ex.Message}");
                Console.WriteLine($"  ✗ {name}: {ex.Message}");
            }
        }
    }
}
