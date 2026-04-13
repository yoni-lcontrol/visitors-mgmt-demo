namespace Amadeus8.Services;

public interface IAmadeusAuthService
{
    Task<string> GetAccessTokenAsync(CancellationToken cancellationToken);
}
