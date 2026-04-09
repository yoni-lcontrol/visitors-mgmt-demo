using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Serilog;
using SocketIOClient;

namespace ScannerService
{
    /// <summary>
    /// Socket.IO client that connects to the NestJS /ws/agents namespace.
    /// Handles enrollment, HMAC registration, heartbeat, command execution,
    /// and scanner hardware status reporting.
    /// </summary>
    public class AgentSocketClient : IDisposable
    {
        private readonly AgentConfig _config;
        private readonly ScannerLifecycleManager _lifecycle;
        private SocketIOClient.SocketIO _socket;
        private Timer _heartbeatTimer;
        private bool _registered;
        private bool _disposed;
        private readonly SemaphoreSlim _connectLock = new SemaphoreSlim(1, 1);

        public bool IsConnected => _socket?.Connected == true;
        public bool IsRegistered => _registered;

        public AgentSocketClient(AgentConfig config, ScannerLifecycleManager lifecycle)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _lifecycle = lifecycle; // nullable when lifecycle manager is not available

            if (_lifecycle != null)
            {
                _lifecycle.OnStateChanged += OnScannerHardwareStateChanged;
            }
        }

        /// <summary>
        /// Main run loop: connects, waits for disconnection, then reconnects.
        /// Mirrors the printer service's ExecuteAsync pattern.
        /// </summary>
        public async Task RunAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    await ConnectAsync(ct);

                    // Wait until disconnected or cancelled
                    while (!ct.IsCancellationRequested && (_socket?.Connected == true))
                        await Task.Delay(1_000, ct);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Log.Warning("Connection failed — retrying in {Delay}ms: {Error}",
                        _config.ReconnectDelayMs, ex.Message);
                }

                if (!ct.IsCancellationRequested)
                {
                    try { await Task.Delay(_config.ReconnectDelayMs, ct); }
                    catch (OperationCanceledException) { break; }
                }
            }
        }

        /// <summary>
        /// Connect to the backend /ws/agents namespace and authenticate.
        /// If no HMAC credentials exist, attempts enrollment first.
        /// </summary>
        public async Task ConnectAsync(CancellationToken ct)
        {
            await _connectLock.WaitAsync(ct);
            try
            {
                _registered = false;
                DisposeSocket();

                var uri = new Uri(new Uri(_config.ServerUrl), "/ws/agents");
                _socket = new SocketIOClient.SocketIO(uri.ToString(), new SocketIOOptions
                {
                    Transport = SocketIOClient.Transport.TransportProtocol.WebSocket,
                    Reconnection = false, // We handle reconnection ourselves in RunAsync
                });

                RegisterEventHandlers();

                Log.Information("Connecting to {Uri}...", uri);
                await _socket.ConnectAsync();
                Log.Information("Socket connected: {Id}", _socket.Id);

                // Decide: enroll or register with HMAC
                if (_config.HasCredentials)
                {
                    await SendAgentRegister();
                }
                else if (!string.IsNullOrEmpty(_config.EnrollmentToken))
                {
                    await SendAgentEnroll();
                }
                else
                {
                    Log.Error("No HMAC credentials and no enrollment token configured. Cannot authenticate.");
                    _socket.Dispose();
                    return;
                }
            }
            finally
            {
                _connectLock.Release();
            }
        }

        /// <summary>
        /// Gracefully disconnect from the backend.
        /// </summary>
        public async Task DisconnectAsync()
        {
            StopHeartbeat();
            _registered = false;

            if (_socket?.Connected == true)
            {
                await _socket.DisconnectAsync();
                Log.Information("Disconnected from backend");
            }
        }

        /// <summary>
        /// Send scan result back to the backend as a command result.
        /// Called by Gemalto when a document is scanned without a prior execute-scan command
        /// (push scan scenario).
        /// </summary>
        public async Task SendScanResult(string correlationId, ScanResult scanResult)
        {
            if (!_registered || _socket?.Connected != true)
            {
                Log.Warning("Cannot send scan result — not connected/registered");
                return;
            }

            var payload = new Dictionary<string, object>
            {
                ["correlationId"] = correlationId,
                ["success"] = !scanResult.error,
                ["result"] = new Dictionary<string, object>
                {
                    ["personId"] = scanResult.personId ?? string.Empty,
                    ["firstName"] = scanResult.firstName ?? string.Empty,
                    ["lastName"] = scanResult.lastName ?? string.Empty,
                    ["identifyNumber"] = scanResult.identifyNumber ?? string.Empty,
                    ["image"] = scanResult.image ?? string.Empty,
                },
            };

            if (scanResult.error)
            {
                payload["errorMessage"] = "Scan failed: could not extract document data";
            }

            await _socket.EmitAsync("agent:command-result", payload);
            Log.Information("Sent command result for correlationId={CorrelationId}, success={Success}",
                correlationId, !scanResult.error);
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            if (_lifecycle != null)
            {
                _lifecycle.OnStateChanged -= OnScannerHardwareStateChanged;
            }

            StopHeartbeat();
            DisposeSocket();
            _connectLock.Dispose();
        }

        // ─── Scanner Hardware Status Reporting ────────────────────────

        /// <summary>
        /// Called when scanner hardware state changes (e.g., USB disconnect/reconnect).
        /// Reports the new state to the backend via the agent socket.
        /// </summary>
        private async void OnScannerHardwareStateChanged(ScannerState previous, ScannerState current)
        {
            Log.Information("Scanner hardware state changed: {Previous} -> {Current}, reporting to backend",
                previous, current);

            if (!_registered || _socket?.Connected != true)
            {
                Log.Debug("Cannot report scanner state change — agent not registered");
                return;
            }

            try
            {
                string status;
                switch (current)
                {
                    case ScannerState.Connected:
                        status = "ready";
                        break;
                    case ScannerState.Reconnecting:
                    case ScannerState.Connecting:
                        status = "reconnecting";
                        break;
                    case ScannerState.Error:
                        status = "error";
                        break;
                    default:
                        status = "not-ready";
                        break;
                }

                await _socket.EmitAsync("agent:status:update", new Dictionary<string, object>
                {
                    ["status"] = status,
                    ["deviceConnected"] = current == ScannerState.Connected,
                    ["scannerType"] = _lifecycle?.Scanner?.ScannerName ?? "unknown",
                    ["scannerState"] = current.ToString(),
                    ["previousState"] = previous.ToString(),
                });

                Log.Information("Reported scanner hardware status to backend: status={Status}, state={State}",
                    status, current);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Failed to report scanner hardware state change to backend");
            }
        }

        // ─── Event Handlers ───────────────────────────────────────────────

        private void RegisterEventHandlers()
        {
            _socket.OnConnected += OnConnected;
            _socket.OnDisconnected += OnDisconnected;
            _socket.OnError += OnError;
            _socket.OnReconnectAttempt += OnReconnectAttempt;

            // Backend → Agent: registration confirmed
            _socket.On("agent:registered", OnAgentRegistered);

            // Backend → Agent: enrollment succeeded (new credentials)
            _socket.On("agent:enrolled", OnAgentEnrolled);

            // Backend → Agent: error
            _socket.On("agent:error", OnAgentError);

            // Backend → Agent: execute scan command
            _socket.On("agent:execute-scan", OnExecuteScan);

            // Backend → Agent: status query
            _socket.On("agent:get-status", OnGetStatus);

            // Backend → Agent: ping
            _socket.On("agent:ping", OnPing);
        }

        private void OnConnected(object sender, EventArgs e)
        {
            Log.Information("Socket.IO connected (id: {SocketId})", _socket?.Id);
        }

        private void OnDisconnected(object sender, string reason)
        {
            Log.Warning("Socket.IO disconnected: {Reason}", reason);
            _registered = false;
            StopHeartbeat();
        }

        private void OnError(object sender, string error)
        {
            Log.Error("Socket.IO error: {Error}", error);
        }

        private void OnReconnectAttempt(object sender, int attempt)
        {
            Log.Information("Reconnection attempt #{Attempt}", attempt);
        }

        private void OnAgentRegistered(SocketIOResponse response)
        {
            try
            {
                var json = response.GetValue<JsonElement>(0);
                var workstationId = json.GetProperty("workstationId").GetString();
                var agentId = json.GetProperty("agentId").GetString();

                _registered = true;
                Log.Information("Agent registered successfully. Workstation={WorkstationId}, AgentId={AgentId}",
                    workstationId, agentId);

                StartHeartbeat();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error processing agent:registered event");
            }
        }

        private void OnAgentEnrolled(SocketIOResponse response)
        {
            try
            {
                var json = response.GetValue<JsonElement>(0);
                var newClientId = json.GetProperty("clientId").GetString();
                var newClientSecret = json.GetProperty("clientSecret").GetString();
                var workstationId = json.GetProperty("workstationId").GetString();

                Log.Information("Enrollment succeeded! clientId={ClientId}, workstation={WorkstationId}",
                    newClientId, workstationId);

                // Persist the HMAC credentials for future connections
                _config.ClientId = newClientId;
                _config.ClientSecret = newClientSecret;
                _config.SaveCredentials();

                Log.Information("Credentials saved. The agent will reconnect using HMAC authentication.");
                // The backend disconnects us after enrollment — reconnect will use HMAC
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error processing agent:enrolled event");
            }
        }

        private void OnAgentError(SocketIOResponse response)
        {
            try
            {
                var json = response.GetValue<JsonElement>(0);
                var reason = json.TryGetProperty("reason", out var r) ? r.GetString() : "(unknown)";
                Log.Error("Agent error from backend: {Reason}", reason);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error processing agent:error event");
            }
        }

        private async void OnExecuteScan(SocketIOResponse response)
        {
            try
            {
                var json = response.GetValue<JsonElement>(0);
                var correlationId = json.GetProperty("correlationId").GetString();
                var actionType = json.TryGetProperty("actionType", out var at) ? at.GetString() : "scan-id";

                Log.Information("Received execute-scan command: correlationId={CorrelationId}, action={Action}",
                    correlationId, actionType);

                // Send acknowledgment
                await _socket.EmitAsync("agent:command-ack", new Dictionary<string, object>
                {
                    ["correlationId"] = correlationId,
                });
                Log.Debug("Sent command-ack for {CorrelationId}", correlationId);

                // Execute the scan via the Gemalto scanner
                if (_lifecycle?.Scanner == null || _lifecycle.State != ScannerState.Connected)
                {
                    var scannerState = _lifecycle?.State.ToString() ?? "unavailable";
                    await _socket.EmitAsync("agent:command-result", new Dictionary<string, object>
                    {
                        ["correlationId"] = correlationId,
                        ["success"] = false,
                        ["errorMessage"] = $"Scanner hardware not available (state: {scannerState})",
                    });
                    return;
                }

                ScanResult scanResult = _lifecycle.Scanner.ExecuteScanCommand();

                // Send the result back
                await SendScanResult(correlationId, scanResult);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error handling execute-scan command");

                // Try to report the error back
                try
                {
                    var json = response.GetValue<JsonElement>(0);
                    var correlId = json.GetProperty("correlationId").GetString();
                    await _socket.EmitAsync("agent:command-result", new Dictionary<string, object>
                    {
                        ["correlationId"] = correlId,
                        ["success"] = false,
                        ["errorMessage"] = $"Scanner error: {ex.Message}",
                    });
                }
                catch { /* best effort */ }
            }
        }

        private async void OnGetStatus(SocketIOResponse response)
        {
            try
            {
                bool scannerReady = _lifecycle?.Scanner?.IsScannerReady == true
                    && _lifecycle.State == ScannerState.Connected;
                string stateStr = _lifecycle?.State.ToString() ?? "disconnected";

                await _socket.EmitAsync("agent:status:update", new Dictionary<string, object>
                {
                    ["status"] = scannerReady ? "ready" : "not-ready",
                    ["deviceConnected"] = scannerReady,
                    ["scannerType"] = _lifecycle?.Scanner?.ScannerName ?? "unknown",
                    ["scannerState"] = stateStr,
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error handling get-status request");
            }
        }

        private async void OnPing(SocketIOResponse response)
        {
            try
            {
                await _socket.EmitAsync("agent:heartbeat", new Dictionary<string, object>
                {
                    ["clientId"] = _config.ClientId ?? string.Empty,
                    ["timestamp"] = HmacAuth.GetTimestampMs(),
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error responding to ping");
            }
        }

        // ─── Registration & Enrollment ────────────────────────────────────

        /// <summary>
        /// Send agent:register with HMAC signature (normal auth flow).
        /// </summary>
        private async Task SendAgentRegister()
        {
            var timestamp = HmacAuth.GetTimestampMs();
            var signature = HmacAuth.ComputeSignature(_config.ClientId, timestamp, _config.ClientSecret);

            var payload = new Dictionary<string, object>
            {
                ["clientId"] = _config.ClientId,
                ["timestamp"] = timestamp,
                ["signature"] = signature,
                ["providerType"] = "scanner",
                ["machineId"] = _config.MachineId,
                ["hostname"] = Environment.MachineName,
                ["version"] = _config.Version,
                ["capabilities"] = new[] { "scan-id", "scan-passport" },
                ["deviceConnected"] = _lifecycle?.State == ScannerState.Connected,
            };

            Log.Information("Sending agent:register (clientId={ClientId})", _config.ClientId);
            await _socket.EmitAsync("agent:register", payload);
        }

        /// <summary>
        /// Send agent:enroll with enrollment token (first-time setup).
        /// </summary>
        private async Task SendAgentEnroll()
        {
            var payload = new Dictionary<string, object>
            {
                ["enrollmentToken"] = _config.EnrollmentToken,
                ["providerType"] = "scanner",
                ["machineId"] = _config.MachineId,
                ["hostname"] = Environment.MachineName,
                ["version"] = _config.Version,
                ["capabilities"] = new[] { "scan-id", "scan-passport" },
            };

            Log.Information("Sending agent:enroll (first-time enrollment)");
            await _socket.EmitAsync("agent:enroll", payload);
        }

        // ─── Heartbeat ───────────────────────────────────────────────────

        private void StartHeartbeat()
        {
            StopHeartbeat();
            _heartbeatTimer = new Timer(async _ =>
            {
                if (!_registered || _socket?.Connected != true) return;
                try
                {
                    await _socket.EmitAsync("agent:heartbeat", new Dictionary<string, object>
                    {
                        ["clientId"] = _config.ClientId ?? string.Empty,
                        ["timestamp"] = HmacAuth.GetTimestampMs(),
                    });
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Heartbeat send failed");
                }
            }, null, _config.HeartbeatIntervalMs, _config.HeartbeatIntervalMs);
        }

        private void StopHeartbeat()
        {
            _heartbeatTimer?.Dispose();
            _heartbeatTimer = null;
        }

        private void DisposeSocket()
        {
            if (_socket != null)
            {
                try { _socket.Dispose(); } catch { /* ignore */ }
                _socket = null;
            }
        }
    }
}
