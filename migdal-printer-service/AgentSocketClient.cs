using System.Text.Json;
using SocketIOClient;
using SocketClient = SocketIOClient.SocketIO;

namespace PrinterService;

/// <summary>
/// Socket.IO client that connects to the NestJS /ws/agents namespace.
/// Handles enrollment, HMAC registration, heartbeat, and print command execution.
/// Replaces the legacy PrinterSocketManager and PrinterSocketWorker.
/// </summary>
public sealed class AgentSocketClient : BackgroundService
{
    private readonly AgentConfig _config;
    private readonly PrinterManager _printer;
    private readonly ILogger<AgentSocketClient> _log;
    private SocketClient? _socket;
    private System.Threading.Timer? _heartbeatTimer;
    private bool _registered;

    public AgentSocketClient(AgentConfig config, PrinterManager printer, ILogger<AgentSocketClient> logger)
    {
        _config = config;
        _printer = printer;
        _log = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Give PrinterManager time to initialize SDK
        await SafeDelay(2_000, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ConnectAsync(stoppingToken);

                // Wait until disconnected or cancelled
                while (!stoppingToken.IsCancellationRequested && (_socket?.Connected == true))
                    await SafeDelay(1_000, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Connection failed — retrying in {Delay}ms", _config.ReconnectDelayMs);
            }

            if (!stoppingToken.IsCancellationRequested)
                await SafeDelay(_config.ReconnectDelayMs, stoppingToken);
        }
    }

    private async Task ConnectAsync(CancellationToken ct)
    {
        _registered = false;
        DisposeSocket();

        var uri = new Uri(new Uri(_config.ServerUrl), "/ws/agents");

        _socket = new SocketClient(uri.ToString(), new SocketIOOptions
        {
            Transport = SocketIOClient.Transport.TransportProtocol.WebSocket,
            Reconnection = false, // We handle reconnection ourselves in ExecuteAsync
        });

        RegisterEventHandlers();

        _log.LogInformation("Connecting to {Uri}...", uri);
        await _socket.ConnectAsync(ct);
        _log.LogInformation("Socket connected: {Id}", _socket.Id);

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
            _log.LogError("No HMAC credentials and no enrollment token configured. Cannot authenticate.");
            _socket.Dispose();
        }
    }

    // ─── Event Handlers ───────────────────────────────────────────────

    private void RegisterEventHandlers()
    {
        _socket!.OnConnected += (_, _) =>
            _log.LogInformation("Socket.IO connected (id: {SocketId})", _socket?.Id);

        _socket.OnDisconnected += (_, reason) =>
        {
            _log.LogWarning("Socket.IO disconnected: {Reason}", reason);
            _registered = false;
            StopHeartbeat();
        };

        _socket.OnError += (_, err) =>
            _log.LogError("Socket.IO error: {Error}", err);

        _socket.OnReconnectAttempt += (_, attempt) =>
            _log.LogInformation("Reconnection attempt #{Attempt}", attempt);

        // Backend → Agent: registration confirmed
        _socket.On("agent:registered", OnAgentRegistered);

        // Backend → Agent: enrollment succeeded (new credentials)
        _socket.On("agent:enrolled", OnAgentEnrolled);

        // Backend → Agent: error
        _socket.On("agent:error", OnAgentError);

        // Backend → Agent: execute print command
        _socket.On("agent:execute-print", OnExecutePrint);

        // Backend → Agent: status query
        _socket.On("agent:get-status", OnGetStatus);

        // Backend → Agent: ping
        _socket.On("agent:ping", OnPing);
    }

    private void OnAgentRegistered(SocketIOResponse response)
    {
        try
        {
            var json = response.GetValue<JsonElement>(0);
            var workstationId = json.GetProperty("workstationId").GetString();
            var agentId = json.GetProperty("agentId").GetString();

            _registered = true;
            _log.LogInformation(
                "Agent registered successfully. Workstation={WorkstationId}, AgentId={AgentId}",
                workstationId, agentId);

            StartHeartbeat();
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error processing agent:registered event");
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

            _log.LogInformation(
                "Enrollment succeeded! clientId={ClientId}, workstation={WorkstationId}",
                newClientId, workstationId);

            _config.ClientId = newClientId!;
            _config.ClientSecret = newClientSecret!;
            _config.SaveCredentials();

            _log.LogInformation("Credentials saved. Agent will reconnect using HMAC authentication.");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error processing agent:enrolled event");
        }
    }

    private void OnAgentError(SocketIOResponse response)
    {
        try
        {
            var json = response.GetValue<JsonElement>(0);
            var reason = json.TryGetProperty("reason", out var r) ? r.GetString() : "(unknown)";
            _log.LogError("Agent error from backend: {Reason}", reason);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error processing agent:error event");
        }
    }

    private async void OnExecutePrint(SocketIOResponse response)
    {
        string? correlationId = null;
        try
        {
            var json = response.GetValue<JsonElement>(0);
            correlationId = json.GetProperty("correlationId").GetString();
            var printData = json.TryGetProperty("printData", out var pd) ? pd : default;
            var printOptions = json.TryGetProperty("printOptions", out var po) ? po : default;

            _log.LogInformation(
                "Received execute-print command: correlationId={CorrelationId}",
                correlationId);

            // Send acknowledgment
            await _socket!.EmitAsync("agent:command-ack", new Dictionary<string, object>
            {
                ["correlationId"] = correlationId!,
            });

            // Dispatch to the appropriate print method based on printData contents
            ExecutePrintCommand(printData, printOptions);

            // Send success result
            await _socket.EmitAsync("agent:command-result", new Dictionary<string, object>
            {
                ["correlationId"] = correlationId!,
                ["success"] = true,
                ["result"] = new Dictionary<string, object> { ["message"] = "Print completed" },
            });

            _log.LogInformation("Print command completed: correlationId={CorrelationId}", correlationId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error handling execute-print command (correlationId={CorrelationId})", correlationId);

            if (correlationId != null && _socket?.Connected == true)
            {
                try
                {
                    await _socket.EmitAsync("agent:command-result", new Dictionary<string, object>
                    {
                        ["correlationId"] = correlationId,
                        ["success"] = false,
                        ["errorMessage"] = $"Print error: {ex.Message}",
                    });
                }
                catch { /* best effort */ }
            }
        }
    }

    /// <summary>
    /// Dispatch a print command to the appropriate PrinterManager method
    /// based on the printData payload from the backend.
    /// </summary>
    private void ExecutePrintCommand(JsonElement printData, JsonElement printOptions)
    {
        if (printData.ValueKind == JsonValueKind.Undefined || printData.ValueKind == JsonValueKind.Null)
            throw new InvalidOperationException("printData is missing from execute-print payload");

        // Direct template printing (new flow — templateJson sent from backend card template system)
        if (printData.TryGetProperty("templateJson", out var templateJsonEl))
        {
            var templateJson = templateJsonEl.ValueKind == JsonValueKind.String
                ? templateJsonEl.GetString()!
                : templateJsonEl.GetRawText();

            var fullName = GetStringProp(printData, "fullName");
            var department = GetStringProp(printData, "department");
            var cardNumber = GetStringProp(printData, "cardNumber");
            var title = GetStringProp(printData, "title");
            var qrValue = GetStringProp(printData, "qrValue", GetStringProp(printData, "idForQr"));
            var image = GetStringProp(printData, "image");

            // Collect all extra fields from printData for the data dictionary
            var extraFields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in printData.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.String)
                    extraFields[prop.Name] = prop.Value.GetString() ?? "";
            }

            _log.LogInformation(
                "Executing template print. FullName={FullName}, CardNumber={CardNumber}",
                fullName, cardNumber);

            _printer.PrintFromTemplate(templateJson, fullName, department, cardNumber, title, qrValue, image, extraFields);
            return;
        }

        // Legacy outerJson wrapper format
        if (printData.TryGetProperty("outerJson", out var outerJsonEl))
        {
            var outerJson = outerJsonEl.ValueKind == JsonValueKind.String
                ? outerJsonEl.GetString()!
                : outerJsonEl.GetRawText();

            var fullName = GetStringProp(printData, "fullName");
            var department = GetStringProp(printData, "department");
            var cardNumber = GetStringProp(printData, "cardNumber");
            var title = GetStringProp(printData, "title");
            var qrValue = GetStringProp(printData, "qrValue", GetStringProp(printData, "idForQr"));
            var image = GetStringProp(printData, "image");

            _log.LogInformation(
                "Executing legacy template print. FullName={FullName}, CardNumber={CardNumber}",
                fullName, cardNumber);

            _printer.PrintFromTemplateOuterJson(outerJson, fullName, department, cardNumber, title, qrValue, image);
            return;
        }

        // Simple card printing (fullName + id)
        if (printData.TryGetProperty("fullName", out _) && printData.TryGetProperty("id", out _))
        {
            var fullName = GetStringProp(printData, "fullName");
            var id = GetStringProp(printData, "id");

            _log.LogInformation("Executing simple card print. FullName={FullName}, Id={Id}", fullName, id);
            _printer.PrintCard(fullName, id);
            return;
        }

        // Text printing
        if (printData.TryGetProperty("text", out _))
        {
            var text = GetStringProp(printData, "text");
            var bold = printData.TryGetProperty("bold", out var b) && b.GetBoolean();
            var italic = printData.TryGetProperty("italic", out var i) && i.GetBoolean();
            var underline = printData.TryGetProperty("underline", out var u) && u.GetBoolean();

            _log.LogInformation("Executing text print. TextLength={Length}", text.Length);
            _printer.PrintText(text, bold, italic, underline);
            return;
        }

        throw new InvalidOperationException(
            "Unrecognized printData payload — must contain outerJson/templateJson, fullName+id, or text");
    }

    private async void OnGetStatus(SocketIOResponse response)
    {
        try
        {
            var status = _printer.GetStatus();
            await _socket!.EmitAsync("agent:status:update", new Dictionary<string, object>
            {
                ["status"] = status,
                ["printerType"] = "CuCustomWnd",
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error handling get-status request");
        }
    }

    private async void OnPing(SocketIOResponse response)
    {
        try
        {
            await _socket!.EmitAsync("agent:heartbeat", new Dictionary<string, object>
            {
                ["clientId"] = _config.ClientId,
                ["timestamp"] = HmacAuth.GetTimestampMs(),
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error responding to ping");
        }
    }

    // ─── Registration & Enrollment ────────────────────────────────────

    private async Task SendAgentRegister()
    {
        var timestamp = HmacAuth.GetTimestampMs();
        var signature = HmacAuth.ComputeSignature(_config.ClientId, timestamp, _config.ClientSecret);

        var payload = new Dictionary<string, object>
        {
            ["clientId"] = _config.ClientId,
            ["timestamp"] = timestamp,
            ["signature"] = signature,
            ["providerType"] = "printer",
            ["machineId"] = _config.MachineId,
            ["hostname"] = Environment.MachineName,
            ["version"] = _config.Version,
            ["capabilities"] = new[] { "print-card", "print-text", "print-template" },
        };

        _log.LogInformation("Sending agent:register (clientId={ClientId})", _config.ClientId);
        await _socket!.EmitAsync("agent:register", payload);
    }

    private async Task SendAgentEnroll()
    {
        var payload = new Dictionary<string, object>
        {
            ["enrollmentToken"] = _config.EnrollmentToken,
            ["providerType"] = "printer",
            ["machineId"] = _config.MachineId,
            ["hostname"] = Environment.MachineName,
            ["version"] = _config.Version,
            ["capabilities"] = new[] { "print-card", "print-text", "print-template" },
        };

        _log.LogInformation("Sending agent:enroll (first-time enrollment)");
        await _socket!.EmitAsync("agent:enroll", payload);
    }

    // ─── Heartbeat ───────────────────────────────────────────────────

    private void StartHeartbeat()
    {
        StopHeartbeat();
        _heartbeatTimer = new System.Threading.Timer(async _ =>
        {
            if (!_registered || _socket?.Connected != true) return;
            try
            {
                await _socket.EmitAsync("agent:heartbeat", new Dictionary<string, object>
                {
                    ["clientId"] = _config.ClientId,
                    ["timestamp"] = HmacAuth.GetTimestampMs(),
                });
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Heartbeat send failed");
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

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _log.LogInformation("Stopping PrinterService agent...");
        StopHeartbeat();
        _registered = false;

        try
        {
            if (_socket?.Connected == true)
                await _socket.DisconnectAsync();
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Socket disconnect during shutdown (expected)");
        }

        DisposeSocket();

        try
        {
            await base.StopAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // Expected during Ctrl+C shutdown
        }
        catch (AggregateException ex) when (ex.InnerExceptions.All(
            e => e is InvalidOperationException || e is OperationCanceledException))
        {
            // Expected: ExecuteAsync task already completed before StopAsync signaled it
        }

        _log.LogInformation("PrinterService agent stopped.");
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private static string GetStringProp(JsonElement el, string name, string fallback = "")
    {
        return el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? fallback
            : fallback;
    }

    private static async Task SafeDelay(int ms, CancellationToken ct)
    {
        try { await Task.Delay(ms, ct); }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
    }
}
