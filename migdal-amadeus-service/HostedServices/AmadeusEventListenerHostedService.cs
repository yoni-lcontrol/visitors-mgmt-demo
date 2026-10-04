using Amadeus8.Configurations;
using Amadeus8.Services;
using Microsoft.Extensions.Options;

namespace Amadeus8.HostedServices;

public class AmadeusEventListenerHostedService : BackgroundService
{
    private readonly IAmadeusSignalRClient _signalRClient;
    private readonly AmadeusOptions _options;
    private readonly ILogger<AmadeusEventListenerHostedService> _logger;

    public AmadeusEventListenerHostedService(
        IAmadeusSignalRClient signalRClient,
        IOptions<AmadeusOptions> options,
        ILogger<AmadeusEventListenerHostedService> logger)
    {
        _signalRClient = signalRClient;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Amadeus event listener hosted service starting");

        var consecutiveFailures = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _signalRClient.ConnectAsync(stoppingToken);
                consecutiveFailures = 0;

                // Stay alive while connected; break out when disconnected so the outer loop reconnects
                while (!stoppingToken.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

                    var status = _signalRClient.GetStatus();
                    if (status.CurrentState == "Disconnected")
                    {
                        _logger.LogWarning("Amadeus SignalR connection state is Disconnected, breaking out to reconnect");
                        break;
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Amadeus event listener stopping due to cancellation");
                break;
            }
            catch (Exception ex)
            {
                consecutiveFailures++;
                var delaySeconds = GetBackoffDelaySeconds(consecutiveFailures);

                _logger.LogError(ex,
                    "Amadeus event listener encountered an error (consecutive failure {ConsecutiveFailures}), retrying in {DelaySeconds} seconds",
                    consecutiveFailures,
                    delaySeconds);

                try
                {
                    await _signalRClient.DisconnectAsync(CancellationToken.None);
                }
                catch (Exception disconnectEx)
                {
                    _logger.LogWarning(disconnectEx, "Error during SignalR disconnect after failure");
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(delaySeconds), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
            }
        }

        try
        {
            await _signalRClient.DisconnectAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error during final SignalR disconnect on shutdown");
        }

        _logger.LogInformation("Amadeus event listener hosted service stopped");
    }

    private int GetBackoffDelaySeconds(int consecutiveFailures)
    {
        // Exponential backoff from the base delay, capped so we never stop retrying
        // but also stop hammering an unreachable gateway every few seconds.
        var uncappedDelay = _options.ListenerReconnectDelaySeconds * Math.Pow(2, consecutiveFailures - 1);
        var cappedDelay = Math.Min(uncappedDelay, _options.ListenerReconnectMaxDelaySeconds);
        return (int)cappedDelay;
    }
}
