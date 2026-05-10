using Amadeus8.Models;

namespace Amadeus8.Services;

public interface IAmadeusApiClient
{
    // Infrastructure
    Task<List<AmadeusController>> GetControllersAsync(CancellationToken cancellationToken);
    Task<(List<AmadeusController> Items, int? TotalCount)> GetControllersPagedAsync(int skip, int top, CancellationToken cancellationToken);
    Task<List<AmadeusReader>> GetReadersAsync(CancellationToken cancellationToken);
    Task<(List<AmadeusReader> Items, int? TotalCount)> GetReadersPagedAsync(int skip, int top, CancellationToken cancellationToken);
    Task<List<AmadeusInput>> GetInputsAsync(CancellationToken cancellationToken);
    Task<(List<AmadeusInput> Items, int? TotalCount)> GetInputsPagedAsync(int skip, int top, CancellationToken cancellationToken);
    Task<List<AmadeusOutput>> GetOutputsAsync(CancellationToken cancellationToken);
    Task<(List<AmadeusOutput> Items, int? TotalCount)> GetOutputsPagedAsync(int skip, int top, CancellationToken cancellationToken);

    // Access model
    Task<List<AmadeusSecurityGroup>> GetSecurityGroupsAsync(CancellationToken cancellationToken);
    Task<(List<AmadeusSecurityGroup> Items, int? TotalCount)> GetSecurityGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken);
    Task<List<AmadeusAccessGroup>> GetAccessGroupsAsync(CancellationToken cancellationToken);
    Task<(List<AmadeusAccessGroup> Items, int? TotalCount)> GetAccessGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken);

    // Cardholders
    Task<(List<AmadeusCardholder> Items, int? TotalCount)> GetCardholdersPagedAsync(int skip, int top, CancellationToken cancellationToken);
    Task<AmadeusCardholder?> GetCardholderByUidAsync(string uid, CancellationToken cancellationToken);
    Task<AmadeusCardholder> CreateCardholderAsync(object payload, CancellationToken cancellationToken);
    Task UpdateCardholderAsync(string uid, object payload, CancellationToken cancellationToken);
    Task DeleteCardholderAsync(string uid, CancellationToken cancellationToken);

    // Cardholder personal details (license plate)
    Task<AmadeusCardholderPersonalDetails?> GetCardholderPersonalDetailsAsync(string cardholderUid, CancellationToken cancellationToken);
    Task<AmadeusCardholderPersonalDetails> UpsertLicensePlateAsync(string cardholderUid, string licensePlate, CancellationToken cancellationToken);
}
