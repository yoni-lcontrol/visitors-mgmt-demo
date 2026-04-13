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

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _signalRClient.ConnectAsync(stoppingToken);

                // Stay alive while connected, the SignalR client handles events via callbacks
                while (!stoppingToken.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("Amadeus event listener stopping due to cancellation");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Amadeus event listener encountered an error, retrying in {DelaySeconds} seconds",
                    _options.ListenerReconnectDelaySeconds);

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
                    await Task.Delay(
                        TimeSpan.FromSeconds(_options.ListenerReconnectDelaySeconds),
                        stoppingToken);
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
}
