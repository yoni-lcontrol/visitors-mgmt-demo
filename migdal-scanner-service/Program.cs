using System;
using Serilog;
using System.Text;
using System.Threading;
using System.ServiceProcess;
using System.Threading.Tasks;

namespace ScannerService
{
    internal class Program
    {
        public const string ServiceName = "!ScannerService";
        private static CancellationTokenSource _cts;
        private static KioskSocketServer _kioskServer;
        private static ScannerLifecycleManager _lifecycle;
        private static AgentConfig _config;

        static void Main(string[] args)
        {
            Logger.ConfigureLogger();

            // Run tests if --test flag is passed
            if (args.Length > 0 && args[0] == "--test")
            {
                Tests.ScannerServiceTests.Run();
                return;
            }

            if (!Environment.UserInteractive)
                // running as service
                using (var service = new Service())
                    ServiceBase.Run(service);
            else
            {
                Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
                Console.OutputEncoding = Encoding.GetEncoding("Windows-1255");

                // running as console app
                Start(args);

                Log.Information("Press any key to stop...");
                Console.ReadKey(true);

                Stop();
            }
        }

        public static void Start(string[] args)
        {
            _cts = new CancellationTokenSource();
            _config = AgentConfig.Load();

            // Initialize the scanner lifecycle manager (handles init, poll, disconnect, reconnect)
            _lifecycle = new ScannerLifecycleManager(
                _config,
                _config.ScannerPollIntervalMs,
                _config.ScannerReconnectIntervalMs,
                _config.ScannerMaxReconnectIntervalMs);
            bool scannerReady = _lifecycle.Initialize();

            if (!scannerReady)
            {
                Log.Warning("Scanner not available at startup. The lifecycle manager will retry automatically.");
            }

            // Wire up scan-started event: notify the kiosk when scanning begins
            Action onScanStarted = async () =>
            {
                if (_kioskServer?.IsKioskConnected == true)
                {
                    await _kioskServer.BroadcastScanStarted();
                }
            };

            // Wire up auto-scan events: when a document is auto-detected in tray,
            // send the result to the kiosk via the local socket server.
            Action<ScanResult> onScanCompleted = async (scanResult) =>
            {
                if (_kioskServer?.IsKioskConnected == true)
                {
                    await _kioskServer.BroadcastScanResultFromDevice(
                        string.Format("auto-{0:N}", Guid.NewGuid()),
                        scanResult
                    );
                }
                else
                {
                    Log.Warning("Scan completed but no kiosk connected - result discarded");
                }
            };

            if (_lifecycle.Scanner != null)
            {
                _lifecycle.WireScanStartedEvent(onScanStarted);
                _lifecycle.WireScanCompletedEvent(onScanCompleted);
            }

            // Wire auto-scan events if device is created later (e.g. factory retry when initial creation failed)
            // Since Reinitialize() reuses the same device instance, we only need to wire once.
            bool eventWired = _lifecycle.Scanner != null;
            _lifecycle.OnStateChanged += (previous, current) =>
            {
                if (current == ScannerState.Connected && _lifecycle.Scanner != null && !eventWired)
                {
                    _lifecycle.WireScanStartedEvent(onScanStarted);
                    _lifecycle.WireScanCompletedEvent(onScanCompleted);
                    eventWired = true;
                    Log.Information("Auto-scan event handler wired after first successful connection");
                }
            };

            // Start the local WebSocket server the paired kiosk connects to
            _kioskServer = new KioskSocketServer(_config, _lifecycle);
            try
            {
                _kioskServer.Start();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to start kiosk socket server");
            }

            // Start scanner lifecycle run loop (polling + disconnect detection + reconnect)
            Task.Run(() =>
            {
                try
                {
                    _lifecycle.Run(_cts.Token);
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Scanner lifecycle run loop failed");
                }
            });
        }

        public static void Stop()
        {
            try
            {
                Log.Information("Stopping scanner service...");
                _cts?.Cancel();

                if (_kioskServer != null)
                {
                    _kioskServer.StopAsync().GetAwaiter().GetResult();
                    _kioskServer.Dispose();
                    _kioskServer = null;
                }

                if (_lifecycle != null)
                {
                    _lifecycle.Dispose();
                    _lifecycle = null;
                }

                _cts?.Dispose();
                _cts = null;

                Log.Information("Scanner service stopped");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error during Stop()");
            }
        }
    }
}
