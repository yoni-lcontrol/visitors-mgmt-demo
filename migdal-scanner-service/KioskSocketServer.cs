using System;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Serilog;

namespace ScannerService
{
    /// <summary>
    /// Local WebSocket server the kiosk app (on a paired workstation on the same LAN)
    /// connects to directly. Replaces the old outbound Socket.IO client to the backend
    /// (/ws/agents) — the backend is no longer part of the scan command/result path.
    /// Accepts a single active kiosk connection at a time.
    /// </summary>
    public class KioskSocketServer : IDisposable
    {
        private static readonly TimeSpan HelloTimeout = TimeSpan.FromSeconds(15);

        private readonly AgentConfig _config;
        private readonly ScannerLifecycleManager _lifecycle;
        private readonly SemaphoreSlim _sendLock = new SemaphoreSlim(1, 1);

        private HttpListener _listener;
        private CancellationTokenSource _cts;
        private Task _acceptLoopTask;
        private WebSocket _activeSocket;
        private bool _disposed;

        public bool IsKioskConnected => _activeSocket?.State == WebSocketState.Open;

        public KioskSocketServer(AgentConfig config, ScannerLifecycleManager lifecycle)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _lifecycle = lifecycle;

            if (_lifecycle != null)
            {
                _lifecycle.OnStateChanged += OnScannerHardwareStateChanged;
            }
        }

        /// <summary>
        /// Start listening for the kiosk's connection. Throws if the port can't be bound
        /// (e.g. missing URL ACL reservation or firewall rule — see deployment docs).
        /// </summary>
        public void Start()
        {
            _cts = new CancellationTokenSource();
            var prefix = $"http://+:{_config.LocalServerPort}/scanner/";

            _listener = new HttpListener();
            _listener.Prefixes.Add(prefix);

            try
            {
                _listener.Start();
                Log.Information("Kiosk socket server listening on {Prefix}", prefix);
            }
            catch (HttpListenerException ex)
            {
                Log.Error(ex,
                    "Failed to bind {Prefix}. Ensure a URL ACL reservation exists (netsh http add urlacl) " +
                    "and the Windows Firewall allows inbound connections on this port.", prefix);
                throw;
            }

            _acceptLoopTask = Task.Run(() => AcceptLoopAsync(_cts.Token));
        }

        public async Task StopAsync()
        {
            _cts?.Cancel();

            try { _listener?.Stop(); } catch { /* ignore */ }

            var socket = _activeSocket;
            if (socket != null && socket.State == WebSocketState.Open)
            {
                try { await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "shutdown", CancellationToken.None); }
                catch { /* ignore */ }
            }

            if (_acceptLoopTask != null)
            {
                try { await _acceptLoopTask; }
                catch { /* ignore */ }
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            if (_lifecycle != null)
            {
                _lifecycle.OnStateChanged -= OnScannerHardwareStateChanged;
            }

            try { _listener?.Close(); } catch { /* ignore */ }
            _cts?.Dispose();
            _sendLock.Dispose();
        }

        // ─── Accept loop ───────────────────────────────────────────────

        private async Task AcceptLoopAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                HttpListenerContext context;
                try
                {
                    context = await _listener.GetContextAsync();
                }
                catch (Exception) when (ct.IsCancellationRequested || _disposed)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Error accepting incoming connection");
                    continue;
                }

                if (!context.Request.IsWebSocketRequest)
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                    continue;
                }

                _ = HandleConnectionAsync(context, ct);
            }
        }

        private async Task HandleConnectionAsync(HttpListenerContext context, CancellationToken serverCt)
        {
            WebSocket socket = null;
            try
            {
                var wsContext = await context.AcceptWebSocketAsync(null);
                socket = wsContext.WebSocket;

                var previous = _activeSocket;
                _activeSocket = socket;
                if (previous != null && previous.State == WebSocketState.Open)
                {
                    Log.Information("New kiosk connection replacing previous one");
                    try { await previous.CloseAsync(WebSocketCloseStatus.PolicyViolation, "replaced-by-new-connection", CancellationToken.None); }
                    catch { /* ignore */ }
                }

                Log.Information("Kiosk connected from {RemoteEndPoint}", context.Request.RemoteEndPoint);

                if (!await WaitForHelloAsync(socket, serverCt))
                {
                    Log.Warning("Kiosk connection rejected — authentication failed or timed out");
                    await CloseQuietly(socket, "authentication failed");
                    return;
                }

                await SendCurrentStatus(socket);
                await ReceiveLoopAsync(socket, serverCt);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Error handling kiosk connection");
            }
            finally
            {
                if (ReferenceEquals(_activeSocket, socket))
                {
                    _activeSocket = null;
                }
                Log.Information("Kiosk disconnected");
            }
        }

        private async Task<bool> WaitForHelloAsync(WebSocket socket, CancellationToken ct)
        {
            using (var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct))
            {
                timeoutCts.CancelAfter(HelloTimeout);
                try
                {
                    var message = await ReceiveOneMessageAsync(socket, timeoutCts.Token);
                    if (message == null) return false;

                    using (var doc = JsonDocument.Parse(message))
                    {
                        var root = doc.RootElement;
                        var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;
                        var token = root.TryGetProperty("token", out var tok) ? tok.GetString() : null;

                        if (type != "hello")
                        {
                            await SendMessage(socket, new { type = "hello-reject", reason = "expected hello" });
                            return false;
                        }

                        if (!string.IsNullOrEmpty(_config.LocalServerToken) && token != _config.LocalServerToken)
                        {
                            await SendMessage(socket, new { type = "hello-reject", reason = "invalid token" });
                            return false;
                        }

                        await SendMessage(socket, new { type = "hello-ack" });
                        return true;
                    }
                }
                catch (OperationCanceledException)
                {
                    return false;
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Error processing hello handshake");
                    return false;
                }
            }
        }

        private async Task ReceiveLoopAsync(WebSocket socket, CancellationToken ct)
        {
            while (socket.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                string message;
                try
                {
                    message = await ReceiveOneMessageAsync(socket, ct);
                }
                catch (Exception ex)
                {
                    Log.Debug(ex, "Kiosk socket receive loop ending");
                    break;
                }

                if (message == null) break;

                try
                {
                    await HandleIncomingMessage(socket, message);
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Error handling message from kiosk: {Message}", message);
                }
            }
        }

        private async Task HandleIncomingMessage(WebSocket socket, string message)
        {
            using (var doc = JsonDocument.Parse(message))
            {
                var type = doc.RootElement.TryGetProperty("type", out var t) ? t.GetString() : null;

                switch (type)
                {
                    case "request-scan":
                        await HandleRequestScan();
                        break;

                    case "check-status":
                        await SendCurrentStatus(socket);
                        break;

                    default:
                        Log.Debug("Ignoring unknown message type from kiosk: {Type}", type ?? "(none)");
                        break;
                }
            }
        }

        private async Task HandleRequestScan()
        {
            var correlationId = $"req-{Guid.NewGuid():N}";
            Log.Information("Kiosk requested scan (correlationId={CorrelationId})", correlationId);

            if (_lifecycle?.Scanner == null || _lifecycle.State != ScannerState.Connected)
            {
                var scannerState = _lifecycle?.State.ToString() ?? "unavailable";
                await BroadcastScanResult(correlationId, false, null, $"Scanner hardware not available (state: {scannerState})");
                return;
            }

            try
            {
                ScanResult scanResult = _lifecycle.Scanner.ExecuteScanCommand();
                await BroadcastScanResultFromDevice(correlationId, scanResult);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error executing requested scan");
                await BroadcastScanResult(correlationId, false, null, $"Scanner error: {ex.Message}");
            }
        }

        // ─── Scanner hardware event wiring (called from Program.cs) ────

        /// <summary>Called when the scanner auto-detects and completes a scan without a prior request.</summary>
        public async Task BroadcastScanResultFromDevice(string correlationId, ScanResult scanResult)
        {
            if (scanResult.error)
            {
                await BroadcastScanResult(correlationId, false, null, "Scan failed: could not extract document data");
                return;
            }

            var data = new
            {
                personId = scanResult.personId ?? string.Empty,
                firstName = scanResult.firstName ?? string.Empty,
                lastName = scanResult.lastName ?? string.Empty,
                identifyNumber = scanResult.identifyNumber ?? string.Empty,
                image = scanResult.image ?? string.Empty,
            };
            await BroadcastScanResult(correlationId, true, data, null);
        }

        private async Task BroadcastScanResult(string correlationId, bool success, object result, string errorMessage)
        {
            var socket = _activeSocket;
            if (socket == null || socket.State != WebSocketState.Open)
            {
                Log.Warning("Cannot send scan result — no kiosk connected");
                return;
            }

            await SendMessage(socket, new
            {
                type = "scan-result",
                correlationId,
                success,
                result,
                errorMessage,
            });
        }

        /// <summary>Notify the kiosk that scanning has started (paper detected / command executing).</summary>
        public async Task BroadcastScanStarted()
        {
            var socket = _activeSocket;
            if (socket == null || socket.State != WebSocketState.Open) return;

            await SendMessage(socket, new
            {
                type = "scan-status",
                state = "scanning",
                message = "Scanning in progress",
                scanning = true,
                processing = false,
                progress = 0,
                serverTimeUtc = DateTime.UtcNow.ToString("o"),
            });
        }

        private async void OnScannerHardwareStateChanged(ScannerState previous, ScannerState current)
        {
            try
            {
                await SendCurrentStatus(_activeSocket);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Failed to report scanner hardware state change to kiosk");
            }
        }

        private async Task SendCurrentStatus(WebSocket socket)
        {
            if (socket == null || socket.State != WebSocketState.Open) return;

            bool scannerReady = _lifecycle?.Scanner?.IsScannerReady == true
                && _lifecycle.State == ScannerState.Connected;
            string stateStr = _lifecycle?.State.ToString() ?? "disconnected";

            await SendMessage(socket, new
            {
                type = "status",
                connected = true,
                deviceConnected = scannerReady,
                scannerType = _lifecycle?.Scanner?.ScannerName ?? "unknown",
                scannerState = stateStr,
            });
        }

        // ─── Low-level WebSocket helpers ────────────────────────────────

        private async Task<string> ReceiveOneMessageAsync(WebSocket socket, CancellationToken ct)
        {
            var buffer = new byte[8192];
            using (var stream = new System.IO.MemoryStream())
            {
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), ct);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        return null;
                    }
                    stream.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage);

                return Encoding.UTF8.GetString(stream.ToArray());
            }
        }

        private async Task SendMessage(WebSocket socket, object payload)
        {
            if (socket == null || socket.State != WebSocketState.Open) return;

            var json = JsonSerializer.Serialize(payload);
            var bytes = Encoding.UTF8.GetBytes(json);

            await _sendLock.WaitAsync();
            try
            {
                if (socket.State == WebSocketState.Open)
                {
                    await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                }
            }
            finally
            {
                _sendLock.Release();
            }
        }

        private async Task CloseQuietly(WebSocket socket, string reason)
        {
            try
            {
                if (socket.State == WebSocketState.Open)
                {
                    await socket.CloseAsync(WebSocketCloseStatus.PolicyViolation, reason, CancellationToken.None);
                }
            }
            catch { /* ignore */ }
        }
    }
}
