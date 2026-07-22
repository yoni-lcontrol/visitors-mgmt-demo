using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace PrinterService;

/// <summary>
/// Local WebSocket server the kiosk app (on a paired workstation on the same LAN)
/// connects to directly. Replaces the old outbound Socket.IO client to the backend
/// (/ws/agents) — the backend is no longer part of the print command/result path.
/// Accepts a single active kiosk connection at a time.
/// </summary>
public sealed class KioskSocketServer : BackgroundService
{
    private static readonly TimeSpan HelloTimeout = TimeSpan.FromSeconds(15);

    private readonly AgentConfig _config;
    private readonly PrinterManager _printer;
    private readonly ILogger<KioskSocketServer> _log;
    private readonly SemaphoreSlim _sendLock = new(1, 1);

    private HttpListener? _listener;
    private WebSocket? _activeSocket;

    public KioskSocketServer(AgentConfig config, PrinterManager printer, ILogger<KioskSocketServer> logger)
    {
        _config = config;
        _printer = printer;
        _log = logger;

        _printer.OnDeviceStateChanged += OnPrinterDeviceStateChanged;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var prefix = $"http://+:{_config.LocalServerPort}/printer/";

        _listener = new HttpListener();
        _listener.Prefixes.Add(prefix);

        try
        {
            _listener.Start();
            _log.LogInformation("Kiosk socket server listening on {Prefix}", prefix);
        }
        catch (HttpListenerException ex)
        {
            _log.LogError(ex,
                "Failed to bind {Prefix}. Ensure a URL ACL reservation exists (netsh http add urlacl) " +
                "and the Windows Firewall allows inbound connections on this port.", prefix);
            return;
        }

        await AcceptLoopAsync(stoppingToken);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _printer.OnDeviceStateChanged -= OnPrinterDeviceStateChanged;

        try { _listener?.Stop(); } catch { /* ignore */ }

        var socket = _activeSocket;
        if (socket != null && socket.State == WebSocketState.Open)
        {
            try { await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "shutdown", CancellationToken.None); }
            catch { /* ignore */ }
        }

        await base.StopAsync(cancellationToken);
    }

    // ─── Accept loop ───────────────────────────────────────────────

    private async Task AcceptLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            HttpListenerContext context;
            try
            {
                context = await _listener!.GetContextAsync();
            }
            catch (Exception) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Error accepting incoming connection");
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
        WebSocket? socket = null;
        try
        {
            var wsContext = await context.AcceptWebSocketAsync(null);
            socket = wsContext.WebSocket;

            var previous = _activeSocket;
            _activeSocket = socket;
            if (previous != null && previous.State == WebSocketState.Open)
            {
                _log.LogInformation("New kiosk connection replacing previous one");
                try { await previous.CloseAsync(WebSocketCloseStatus.PolicyViolation, "replaced-by-new-connection", CancellationToken.None); }
                catch { /* ignore */ }
            }

            _log.LogInformation("Kiosk connected from {RemoteEndPoint}", context.Request.RemoteEndPoint);

            if (!await WaitForHelloAsync(socket, serverCt))
            {
                _log.LogWarning("Kiosk connection rejected — authentication failed or timed out");
                await CloseQuietly(socket, "authentication failed");
                return;
            }

            await SendCurrentStatus(socket);
            await ReceiveLoopAsync(socket, serverCt);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Error handling kiosk connection");
        }
        finally
        {
            if (ReferenceEquals(_activeSocket, socket))
            {
                _activeSocket = null;
            }
            _log.LogInformation("Kiosk disconnected");
        }
    }

    private async Task<bool> WaitForHelloAsync(WebSocket socket, CancellationToken ct)
    {
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(HelloTimeout);
        try
        {
            var message = await ReceiveOneMessageAsync(socket, timeoutCts.Token);
            if (message == null) return false;

            using var doc = JsonDocument.Parse(message);
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
        catch (OperationCanceledException)
        {
            return false;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Error processing hello handshake");
            return false;
        }
    }

    private async Task ReceiveLoopAsync(WebSocket socket, CancellationToken ct)
    {
        while (socket.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            string? message;
            try
            {
                message = await ReceiveOneMessageAsync(socket, ct);
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "Kiosk socket receive loop ending");
                break;
            }

            if (message == null) break;

            try
            {
                await HandleIncomingMessage(socket, message);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Error handling message from kiosk: {Message}", message);
            }
        }
    }

    private async Task HandleIncomingMessage(WebSocket socket, string message)
    {
        using var doc = JsonDocument.Parse(message);
        var root = doc.RootElement;
        var type = root.TryGetProperty("type", out var t) ? t.GetString() : null;

        switch (type)
        {
            case "print-card":
                await HandlePrintCard(root);
                break;

            case "check-status":
                await SendCurrentStatus(socket);
                break;

            default:
                _log.LogDebug("Ignoring unknown message type from kiosk: {Type}", type ?? "(none)");
                break;
        }
    }

    private async Task HandlePrintCard(JsonElement root)
    {
        var correlationId = root.TryGetProperty("correlationId", out var cid) ? cid.GetString() ?? "" : "";
        var printData = root.TryGetProperty("printData", out var pd) ? pd : default;
        var printOptions = root.TryGetProperty("printOptions", out var po) ? po : default;

        _log.LogInformation("Kiosk requested print (correlationId={CorrelationId})", correlationId);

        var socket = _activeSocket;
        await SendMessage(socket, new { type = "print-ack", correlationId });

        try
        {
            ExecutePrintCommand(printData, printOptions);
            await SendMessage(socket, new { type = "print-result", correlationId, success = true });
            _log.LogInformation("Print command completed: correlationId={CorrelationId}", correlationId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Error handling print-card command (correlationId={CorrelationId})", correlationId);
            await SendMessage(socket, new { type = "print-result", correlationId, success = false, errorMessage = $"Print error: {ex.Message}" });
        }
    }

    /// <summary>
    /// Dispatch a print command to the appropriate PrinterManager method
    /// based on the printData payload from the kiosk.
    /// </summary>
    private void ExecutePrintCommand(JsonElement printData, JsonElement printOptions)
    {
        if (printData.ValueKind == JsonValueKind.Undefined || printData.ValueKind == JsonValueKind.Null)
            throw new InvalidOperationException("printData is missing from print-card payload");

        // Direct template printing (templateJson sent from the backend card template system)
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

            var extraFields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in printData.EnumerateObject())
            {
                if (prop.Value.ValueKind == JsonValueKind.String)
                    extraFields[prop.Name] = prop.Value.GetString() ?? "";
            }

            _log.LogInformation("Executing template print. FullName={FullName}, CardNumber={CardNumber}", fullName, cardNumber);
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

            _log.LogInformation("Executing legacy template print. FullName={FullName}, CardNumber={CardNumber}", fullName, cardNumber);
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

    private async void OnPrinterDeviceStateChanged(bool previousConnected, bool currentConnected)
    {
        _log.LogInformation(
            "Printer device state changed: {Previous} -> {Current}, reporting to kiosk",
            previousConnected ? "connected" : "disconnected",
            currentConnected ? "connected" : "disconnected");

        try
        {
            await SendCurrentStatus(_activeSocket);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Failed to report printer device state change to kiosk");
        }
    }

    private async Task SendCurrentStatus(WebSocket? socket)
    {
        if (socket == null || socket.State != WebSocketState.Open) return;

        await SendMessage(socket, new
        {
            type = "status",
            connected = true,
            deviceConnected = _printer.IsDeviceConnected,
            sdkInitialized = _printer.IsSdkInitialized,
        });
    }

    // ─── Low-level WebSocket helpers ────────────────────────────────

    private async Task<string?> ReceiveOneMessageAsync(WebSocket socket, CancellationToken ct)
    {
        var buffer = new byte[8192];
        using var stream = new MemoryStream();

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

    private async Task SendMessage(WebSocket? socket, object payload)
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

    private static string GetStringProp(JsonElement el, string name, string fallback = "")
    {
        return el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? fallback
            : fallback;
    }
}
