using System.Text.Json;
using Amadeus8.Configurations;
using Amadeus8.DTOs;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class AmadeusSignalRClient : IAmadeusSignalRClient, IAsyncDisposable
{
    private readonly IAmadeusAuthService _authService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHostApplicationLifetime _applicationLifetime;
    private readonly AmadeusOptions _options;
    private readonly ILogger<AmadeusSignalRClient> _logger;

    private HubConnection? _connection;
    private bool _isConnected;
    private DateTime? _lastConnectedUtc;
    private DateTime? _lastEventReceivedUtc;
    private string? _lastErrorSummary;

    public AmadeusSignalRClient(
        IAmadeusAuthService authService,
        IServiceScopeFactory scopeFactory,
        IHostApplicationLifetime applicationLifetime,
        IOptions<AmadeusOptions> options,
        ILogger<AmadeusSignalRClient> logger)
    {
        _authService = authService;
        _scopeFactory = scopeFactory;
        _applicationLifetime = applicationLifetime;
        _options = options.Value;
        _logger = logger;
    }

    public async Task ConnectAsync(CancellationToken cancellationToken)
    {
        // Dispose any previous connection before creating a new one
        if (_connection is not null)
        {
            try
            {
                await _connection.DisposeAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error disposing previous SignalR connection");
            }
            _connection = null;
        }

        var hubUrl = AmadeusApiDefinitions.SignalRHubUrl(_options);

        _logger.LogInformation("Connecting to Amadeus SignalR hub at {HubUrl}", hubUrl);

        _connection = new HubConnectionBuilder()
            .WithUrl(hubUrl, options =>
            {
                options.AccessTokenProvider = async () =>
                {
                    try
                    {
                        return await _authService.GetAccessTokenAsync(cancellationToken);
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                    {
                        _logger.LogDebug("SignalR access-token request canceled by application shutdown");
                        return string.Empty;
                    }
                    catch (TaskCanceledException ex)
                    {
                        _logger.LogWarning(ex, "SignalR access-token request was canceled by transport or timeout");
                        return string.Empty;
                    }
                };
            })
            .WithAutomaticReconnect(new RetryPolicy(_options.ListenerReconnectDelaySeconds))
            .Build();

        _connection.Reconnecting += error =>
        {
            _isConnected = false;
            _lastErrorSummary = error?.Message;
            _logger.LogWarning(error, "Amadeus SignalR connection lost, reconnecting...");
            return Task.CompletedTask;
        };

        _connection.Reconnected += connectionId =>
        {
            _isConnected = true;
            _lastConnectedUtc = DateTime.UtcNow;
            _lastErrorSummary = null;
            _logger.LogInformation("Amadeus SignalR reconnected with connectionId {ConnectionId}", connectionId);
            return Task.CompletedTask;
        };

        _connection.Closed += error =>
        {
            _isConnected = false;
            _lastErrorSummary = error?.Message;
            if (error is not null)
            {
                _logger.LogError(error, "Amadeus SignalR connection closed with error");
            }
            else
            {
                _logger.LogInformation("Amadeus SignalR connection closed");
            }
            return Task.CompletedTask;
        };

        RegisterHubMethods(_connection);

        await _connection.StartAsync(cancellationToken);

        _isConnected = true;
        _lastConnectedUtc = DateTime.UtcNow;
        _lastErrorSummary = null;

        _logger.LogInformation("Connected to Amadeus SignalR hub successfully");
    }

    public async Task DisconnectAsync(CancellationToken cancellationToken)
    {
        if (_connection is not null)
        {
            _logger.LogInformation("Disconnecting from Amadeus SignalR hub");
            await _connection.StopAsync(cancellationToken);
            _isConnected = false;
        }
    }

    public ListenerStatusDto GetStatus()
    {
        return new ListenerStatusDto
        {
            IsConnected = _isConnected,
            LastConnectedUtc = _lastConnectedUtc,
            LastEventReceivedUtc = _lastEventReceivedUtc,
            CurrentState = _connection?.State.ToString() ?? "NotInitialized",
            LastErrorSummary = _lastErrorSummary
        };
    }

    private void RegisterHubMethods(HubConnection connection)
    {
        connection.On<JsonElement>("ReceiveEvent", payload => HandleIncomingEventAsync("ReceiveEvent", payload));
        connection.On<JsonElement>("IOEventArrived", payload => HandleIncomingEventAsync("IOEventArrived", payload));
        connection.On<JsonElement>("AccessEventArrived", payload => HandleIncomingEventAsync("AccessEventArrived", payload));
        connection.On<JsonElement>("GeneralEventArrived", payload => HandleIncomingEventAsync("GeneralEventArrived", payload));
        connection.On<JsonElement>("AuditEventArrived", payload => HandleIncomingEventAsync("AuditEventArrived", payload));
        connection.On<JsonElement>("CommEventArrived", payload => HandleIncomingEventAsync("CommEventArrived", payload));
        connection.On<JsonElement>("TechnicalEventArrived", payload => HandleIncomingEventAsync("TechnicalEventArrived", payload));
        connection.On<JsonElement>("AlarmEventArrived", payload => HandleIncomingEventAsync("AlarmEventArrived", payload));
        connection.On<object>("StatusUpdate", payload => HandleStatusUpdate("StatusUpdate", payload));

        _logger.LogInformation("Registered Amadeus SignalR hub methods for event ingestion");
    }

    private Task HandleIncomingEventAsync(string methodName, JsonElement payload)
    {
        var rawJson = payload.GetRawText();
        return ProcessIncomingEventAsync(methodName, rawJson);
    }

    private Task HandleStatusUpdate(string methodName, object payload)
    {
        var rawJson = JsonSerializer.Serialize(payload);
        return ProcessIncomingEventAsync(methodName, rawJson);
    }

    private async Task ProcessIncomingEventAsync(string methodName, string rawJson)
    {
        try
        {
            _lastEventReceivedUtc = DateTime.UtcNow;
            _logger.LogDebug("SignalR event received from method {MethodName}", methodName);

            using var scope = _scopeFactory.CreateScope();
            var eventProcessor = scope.ServiceProvider.GetRequiredService<IEventProcessingService>();
            await eventProcessor.ProcessEventAsync(rawJson, methodName, _applicationLifetime.ApplicationStopping);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing incoming SignalR event from method {MethodName}", methodName);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null)
        { 
            await _connection.DisposeAsync();
        }
    }

    private class RetryPolicy : IRetryPolicy
    {
        private readonly int _delaySeconds;

        public RetryPolicy(int delaySeconds)
        {
            _delaySeconds = delaySeconds;
        }

        public TimeSpan? NextRetryDelay(RetryContext retryContext)
        {
            return TimeSpan.FromSeconds(_delaySeconds);
        }
    }
}
