using Amadeus8.DTOs;

namespace Amadeus8.Services;

public interface IEquipmentStatusService
{
    Task<EquipmentStatusChangeResultDto> ChangeStatusAsync(
        EquipmentStatusChangeDto request,
        CancellationToken cancellationToken);
}
