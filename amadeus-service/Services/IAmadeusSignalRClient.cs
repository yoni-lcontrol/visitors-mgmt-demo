using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IAmadeusSignalRClient
{
    Task ConnectAsync(CancellationToken cancellationToken);
    Task DisconnectAsync(CancellationToken cancellationToken);
    ListenerStatusDto GetStatus();
}
