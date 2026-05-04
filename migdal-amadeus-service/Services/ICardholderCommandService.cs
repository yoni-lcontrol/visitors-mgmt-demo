using Amadeus8.DTOs;
using Amadeus8.Entities;

namespace Amadeus8.Services;

public interface ICardholderCommandService
{
    Task<CardholderDto> CreateCardholderAsync(CardholderCreateDto dto, CancellationToken cancellationToken);
    Task<VisitorCreationResultDto> CreateVisitorAsync(CreateAmadeusVisitorDto dto, CancellationToken cancellationToken);
    Task<VisitorCreationResultDto> DeleteVisitorAsync(string amadeusUid, CancellationToken cancellationToken);
    Task UpdateCardholderAsync(string amadeusUid, CardholderUpdateDto dto, CancellationToken cancellationToken);
    Task DeleteCardholderAsync(string amadeusUid, CancellationToken cancellationToken);
    Task ArchiveCardholderAsync(string amadeusUid, CancellationToken cancellationToken);
    Task<CardholderDto?> GetCardholderByUidAsync(string amadeusUid, CancellationToken cancellationToken);
    Task<List<CardholderDto>> GetCardholdersAsync(CancellationToken cancellationToken);
}
