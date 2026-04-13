namespace Amadeus8.Services;

public interface IEventProcessingService
{
    /// <summary>
    /// Processes a raw JSON event payload received from the Amadeus SignalR hub.
    /// Equipment resolution and active-status filtering are applied before the event
    /// is forwarded to the backend.
    /// </summary>
    /// <param name="rawPayloadJson">Raw JSON string from the Amadeus hub.</param>
    /// <param name="signalRMethodName">
    /// The SignalR method that delivered the payload (e.g. "AccessEventArrived").
    /// Used for logging, routing context, and stored in the event log.
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task ProcessEventAsync(
        string rawPayloadJson,
        string signalRMethodName,
        CancellationToken cancellationToken);
}
