namespace Amadeus8.Services;

public interface IBackendEquipmentSnapshotProvider
{
    Task EnsureLoadedAsync(CancellationToken cancellationToken);
    Task RefreshAsync(CancellationToken cancellationToken);
    BackendEquipmentSnapshot GetCurrent();
}