using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Models;
using Amadeus8.Configurations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Amadeus8.Services;

public class DeviceImportService : IDeviceImportService
{
    private const string StageFetch = "fetch";
    private const string StageValidate = "validate";
    private const string StageMap = "map";
    private const string StageSave = "save";
    private const string StageUpdate = "update";

    private const string CategoryInvalidSourceData = "invalid-source-data";
    private const string CategoryMissingRequiredField = "missing-required-field";
    private const string CategoryBadMapping = "bad-mapping";
    private const string CategoryDuplicateConflict = "duplicate-key-conflict";
    private const string CategoryForeignKeyIssue = "foreign-key-issue";
    private const string CategoryNullValue = "null-value";
    private const string CategoryParsing = "parsing-conversion";
    private const string CategoryDatabaseSave = "database-save-update";
    private const string CategoryUnexpectedApi = "unexpected-api-response";
    private const string CategoryUnhandled = "unhandled";

    private readonly IAmadeusApiClient _apiClient;
    private readonly IBackendEquipmentSnapshotProvider _backendSnapshotProvider;
    private readonly AmadeusDbContext _dbContext;
    private readonly ILogger<DeviceImportService> _logger;
    private readonly int _batchSize;
    private bool _startupSnapshotMissingLogged;

    public DeviceImportService(
        IAmadeusApiClient apiClient,
        IBackendEquipmentSnapshotProvider backendSnapshotProvider,
        AmadeusDbContext dbContext,
        IOptions<AmadeusOptions> options,
        ILogger<DeviceImportService> logger)
    {
        _apiClient = apiClient;
        _backendSnapshotProvider = backendSnapshotProvider;
        _dbContext = dbContext;
        _batchSize = options.Value.InfrastructureImportBatchSize;
        _logger = logger;
    }

    public async Task<SyncResultDto> ImportAllAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting full device import");
        var startedUtc = DateTime.UtcNow;
        var totalResult = new SyncResultDto { Operation = "FullSync", StartedUtc = startedUtc, Success = true };

        if (!await EnsureBackendAvailableAsync(totalResult, cancellationToken))
        {
            return totalResult;
        }

        try
        {
            // Per docs/sync-strategy.md: recommended order — controllers, extensions, readers/doors, IOs
            var controllersResult = await ImportControllersAsync(cancellationToken);
            Accumulate(totalResult, controllersResult);

            var extensionsResult = await ImportExtensionsAsync(cancellationToken);
            Accumulate(totalResult, extensionsResult);

            var doorsResult = await ImportDoorsAsync(cancellationToken);
            Accumulate(totalResult, doorsResult);

            totalResult.CompletedUtc = DateTime.UtcNow;
            totalResult.Success = totalResult.Failed == 0;

            _logger.LogInformation(
                "Full import completed. TotalReceived: {TotalReceived}, Succeeded: {Succeeded}, Created: {Created}, Updated: {Updated}, Unchanged: {Unchanged}, Skipped: {Skipped}, Failed: {Failed}",
                totalResult.TotalReceived,
                totalResult.Succeeded,
                totalResult.Created,
                totalResult.Updated,
                totalResult.Unchanged,
                totalResult.Skipped,
                totalResult.Failed);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            totalResult.Success = false;
            totalResult.CompletedUtc = DateTime.UtcNow;
            totalResult.ErrorMessage = ex.Message;
            RecordFailure(
                totalResult,
                equipmentType: "FullSync",
                externalId: null,
                name: null,
                stage: StageFetch,
                category: CategoryUnhandled,
                message: ex.Message,
                ex);
            _logger.LogError(ex, "Full import failed");
        }

        return totalResult;
    }

    public async Task<SyncResultDto> ImportControllersAsync(CancellationToken cancellationToken)
    {
        var result = new SyncResultDto { Operation = "ImportControllers", StartedUtc = DateTime.UtcNow };

        if (!await EnsureBackendAvailableAsync(result, cancellationToken))
        {
            return result;
        }

        try
        {
            _logger.LogInformation("Importing controllers from Amadeus");
            var skip = 0;
            var batchIndex = 0;
            var processed = 0;
            int? totalCount = null;

            while (!cancellationToken.IsCancellationRequested)
            {
                batchIndex++;
                _logger.LogInformation(
                    "Controller batch {Batch} started. Skip={Skip}, Top={Top}",
                    batchIndex,
                    skip,
                    _batchSize);

                var (externalControllers, count) = await _apiClient.GetControllersPagedAsync(skip, _batchSize, cancellationToken);
                totalCount ??= count;

                if (externalControllers.Count == 0)
                {
                    _logger.LogInformation("Controller batch {Batch} returned no records; stopping paging loop", batchIndex);
                    break;
                }

                result.TotalReceived += externalControllers.Count;
                _logger.LogInformation(
                    "Controller batch {Batch} received {BatchReceived} records from Amadeus",
                    batchIndex,
                    externalControllers.Count);

                foreach (var ext in externalControllers)
                {
                    await ProcessRecordAsync(
                        result,
                        equipmentType: "Controller",
                        externalId: ext.Id,
                        name: ext.Name,
                        cancellationToken,
                        (token, syncResult) => UpsertControllerAsync(ext, token, syncResult),
                        defaultStage: StageMap);
                }

                processed += externalControllers.Count;
                skip += externalControllers.Count;

                _logger.LogInformation(
                    "Controller batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                    batchIndex,
                    externalControllers.Count,
                    processed,
                    totalCount);

                if (externalControllers.Count < _batchSize)
                {
                    break;
                }
            }

            result.Success = result.Failed == 0;
            result.CompletedUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "Controller import completed. TotalReceived: {TotalReceived}, Succeeded: {Succeeded}, Created: {Created}, Updated: {Updated}, Unchanged: {Unchanged}, Skipped: {Skipped}, Failed: {Failed}",
                result.TotalReceived,
                result.Succeeded,
                result.Created,
                result.Updated,
                result.Unchanged,
                result.Skipped,
                result.Failed);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.CompletedUtc = DateTime.UtcNow;
            result.ErrorMessage = ex.Message;
            RecordFailure(
                result,
                equipmentType: "Controller",
                externalId: null,
                name: null,
                stage: StageFetch,
                category: CategoryUnhandled,
                message: ex.Message,
                ex);
            _logger.LogError(ex, "Controller import failed");
        }

        return result;
    }

    public async Task<SyncResultDto> ImportDoorsAsync(CancellationToken cancellationToken)
    {
        var result = new SyncResultDto { Operation = "ImportDoors", StartedUtc = DateTime.UtcNow };

        if (!await EnsureBackendAvailableAsync(result, cancellationToken))
        {
            return result;
        }

        try
        {
            _logger.LogInformation("Importing readers (doors) from Amadeus");
            var skip = 0;
            var batchIndex = 0;
            var processed = 0;
            int? totalCount = null;

            while (!cancellationToken.IsCancellationRequested)
            {
                batchIndex++;
                _logger.LogInformation(
                    "Door batch {Batch} started. Skip={Skip}, Top={Top}",
                    batchIndex,
                    skip,
                    _batchSize);

                var (externalReaders, count) = await _apiClient.GetReadersPagedAsync(skip, _batchSize, cancellationToken);
                totalCount ??= count;

                if (externalReaders.Count == 0)
                {
                    _logger.LogInformation("Door batch {Batch} returned no records; stopping paging loop", batchIndex);
                    break;
                }

                result.TotalReceived += externalReaders.Count;
                _logger.LogInformation(
                    "Door batch {Batch} received {BatchReceived} records from Amadeus",
                    batchIndex,
                    externalReaders.Count);

                foreach (var reader in externalReaders)
                {
                    await ProcessRecordAsync(
                        result,
                        equipmentType: "Door",
                        externalId: reader.Id,
                        name: reader.Name,
                        cancellationToken,
                        (token, syncResult) => UpsertDoorFromReaderAsync(reader, token, syncResult),
                        defaultStage: StageMap);
                }

                processed += externalReaders.Count;
                skip += externalReaders.Count;

                _logger.LogInformation(
                    "Door batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                    batchIndex,
                    externalReaders.Count,
                    processed,
                    totalCount);

                if (externalReaders.Count < _batchSize)
                {
                    break;
                }
            }

            // Also import inputs and outputs as door IOs
            await ImportDoorIosAsync(cancellationToken, result);

            result.Success = result.Failed == 0;
            result.CompletedUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "Door import completed. TotalReceived: {TotalReceived}, Succeeded: {Succeeded}, Created: {Created}, Updated: {Updated}, Unchanged: {Unchanged}, Skipped: {Skipped}, Failed: {Failed}",
                result.TotalReceived,
                result.Succeeded,
                result.Created,
                result.Updated,
                result.Unchanged,
                result.Skipped,
                result.Failed);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.CompletedUtc = DateTime.UtcNow;
            result.ErrorMessage = ex.Message;
            RecordFailure(
                result,
                equipmentType: "Door",
                externalId: null,
                name: null,
                stage: StageFetch,
                category: CategoryUnhandled,
                message: ex.Message,
                ex);
            _logger.LogError(ex, "Door import failed");
        }

        return result;
    }

    public async Task<SyncResultDto> ImportExtensionsAsync(CancellationToken cancellationToken)
    {
        var result = new SyncResultDto { Operation = "ImportExtensions", StartedUtc = DateTime.UtcNow };

        if (!await EnsureBackendAvailableAsync(result, cancellationToken))
        {
            return result;
        }

        try
        {
            // TODO: Confirm whether extensions are explicit Amadeus OData entities or
            // implied by controller/module relationships. Currently using inputs with ModuleId
            // as the extension mapping source. Adjust once verified against real $metadata.

            _logger.LogInformation("Importing extensions from Amadeus (derived from inputs with ModuleId)");
            var seenModules = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await ProcessExtensionSourceInputsAsync(cancellationToken, result, seenModules);
            await ProcessExtensionSourceOutputsAsync(cancellationToken, result, seenModules);

            result.Success = result.Failed == 0;
            result.CompletedUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "Extension import completed. TotalReceived: {TotalReceived}, Succeeded: {Succeeded}, Created: {Created}, Updated: {Updated}, Unchanged: {Unchanged}, Skipped: {Skipped}, Failed: {Failed}",
                result.TotalReceived,
                result.Succeeded,
                result.Created,
                result.Updated,
                result.Unchanged,
                result.Skipped,
                result.Failed);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.CompletedUtc = DateTime.UtcNow;
            result.ErrorMessage = ex.Message;
            RecordFailure(
                result,
                equipmentType: "Extension",
                externalId: null,
                name: null,
                stage: StageFetch,
                category: CategoryUnhandled,
                message: ex.Message,
                ex);
            _logger.LogError(ex, "Extension import failed");
        }

        return result;
    }

    private async Task UpsertControllerAsync(AmadeusController ext, CancellationToken cancellationToken, SyncResultDto result)
    {
        CompareControllerAgainstBackend(ext.Id, ext.Name, ext.IsActive);

        var existing = await _dbContext.Controllers
            .FirstOrDefaultAsync(c => c.ExternalId == ext.Id, cancellationToken);

        if (existing is null)
        {
            var entity = new ControllerEntity
            {
                ExternalId = ext.Id,
                ExternalApiKey = ext.ApiKey,
                Name = ext.Name ?? ext.Id,
                SiteExternalId = ext.SiteId,
                IsActive = ext.IsActive ?? true,
                LastCommunicationStatus = ext.CommStatus,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };
            _dbContext.Controllers.Add(entity);
            result.Created++;
        }
        else
        {
            var changed = false;

            if (existing.Name != (ext.Name ?? ext.Id)) { existing.Name = ext.Name ?? ext.Id; changed = true; }
            if (existing.ExternalApiKey != ext.ApiKey) { existing.ExternalApiKey = ext.ApiKey; changed = true; }
            if (existing.SiteExternalId != ext.SiteId) { existing.SiteExternalId = ext.SiteId; changed = true; }
            if (existing.IsActive != (ext.IsActive ?? true)) { existing.IsActive = ext.IsActive ?? true; changed = true; }
            if (existing.LastCommunicationStatus != ext.CommStatus) { existing.LastCommunicationStatus = ext.CommStatus; changed = true; }

            if (changed)
            {
                existing.UpdatedUtc = DateTime.UtcNow;
                result.Updated++;
            }
            else
            {
                result.Unchanged++;
            }
        }
    }

    private async Task UpsertDoorFromReaderAsync(AmadeusReader reader, CancellationToken cancellationToken, SyncResultDto result)
    {
        CompareDoorAgainstBackend(reader.Id, reader.Name, reader.ControllerId);

        if (string.IsNullOrEmpty(reader.ControllerId))
        {
            RecordSkipped(
                result,
                equipmentType: "Door",
                externalId: reader.Id,
                name: reader.Name,
                stage: StageValidate,
                category: CategoryMissingRequiredField,
                message: "Reader record is missing ControllerId.");
            return;
        }

        var controller = await _dbContext.Controllers
            .FirstOrDefaultAsync(c => c.ExternalId == reader.ControllerId, cancellationToken);

        if (controller is null)
        {
            RecordFailure(
                result,
                equipmentType: "Door",
                externalId: reader.Id,
                name: reader.Name,
                stage: StageMap,
                category: CategoryForeignKeyIssue,
                message: $"Controller '{reader.ControllerId}' was not found for reader import.");
            return;
        }

        var existing = await _dbContext.Doors
            .FirstOrDefaultAsync(d => d.ExternalId == reader.Id, cancellationToken);

        if (existing is null)
        {
            var entity = new DoorEntity
            {
                ExternalId = reader.Id,
                Name = reader.Name ?? reader.Id,
                ControllerId = controller.Id,
                ReaderExternalId = reader.Id,
                PrimaryOutputExternalId = reader.OutputId,
                DoorContactInputExternalId = reader.DoorContactInputId,
                IsActive = true,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };
            _dbContext.Doors.Add(entity);
            result.Created++;
        }
        else
        {
            var changed = false;

            if (existing.Name != (reader.Name ?? reader.Id)) { existing.Name = reader.Name ?? reader.Id; changed = true; }
            if (existing.ControllerId != controller.Id) { existing.ControllerId = controller.Id; changed = true; }
            if (existing.PrimaryOutputExternalId != reader.OutputId) { existing.PrimaryOutputExternalId = reader.OutputId; changed = true; }
            if (existing.DoorContactInputExternalId != reader.DoorContactInputId) { existing.DoorContactInputExternalId = reader.DoorContactInputId; changed = true; }

            if (changed)
            {
                existing.UpdatedUtc = DateTime.UtcNow;
                result.Updated++;
            }
            else
            {
                result.Unchanged++;
            }
        }
    }

    private async Task ImportDoorIosAsync(CancellationToken cancellationToken, SyncResultDto result)
    {
        _logger.LogInformation("Importing door IOs from inputs/outputs");

        await ImportDoorInputsPagedAsync(cancellationToken, result);
        await ImportDoorOutputsPagedAsync(cancellationToken, result);
    }

    private async Task UpsertDoorIoAsync(string externalId, string? controllerExternalId, string? name, string ioType, string direction, CancellationToken cancellationToken, SyncResultDto result)
    {
        CompareDoorIoAgainstBackend(externalId, name, ioType, direction, controllerExternalId);

        if (string.IsNullOrEmpty(controllerExternalId))
        {
            RecordSkipped(
                result,
                equipmentType: "DoorIo",
                externalId: externalId,
                name: name,
                stage: StageValidate,
                category: CategoryMissingRequiredField,
                message: "Door IO record is missing ControllerId.");
            return;
        }

        var controller = await _dbContext.Controllers
            .FirstOrDefaultAsync(c => c.ExternalId == controllerExternalId, cancellationToken);
        if (controller is null)
        {
            RecordFailure(
                result,
                equipmentType: "DoorIo",
                externalId: externalId,
                name: name,
                stage: StageMap,
                category: CategoryForeignKeyIssue,
                message: $"Controller '{controllerExternalId}' was not found for door IO import.");
            return;
        }

        // Find the first door for this controller to associate the IO with
        var door = await _dbContext.Doors
            .FirstOrDefaultAsync(d => d.ControllerId == controller.Id, cancellationToken);
        if (door is null)
        {
            RecordFailure(
                result,
                equipmentType: "DoorIo",
                externalId: externalId,
                name: name,
                stage: StageMap,
                category: CategoryForeignKeyIssue,
                message: $"Door for controller '{controllerExternalId}' was not found for door IO import.");
            return;
        }

        var existing = await _dbContext.DoorIos
            .FirstOrDefaultAsync(io => io.ExternalId == externalId, cancellationToken);

        if (existing is null)
        {
            var entity = new DoorIoEntity
            {
                ExternalId = externalId,
                DoorId = door.Id,
                ControllerId = controller.Id,
                IoType = ioType,
                Direction = direction,
                Name = name ?? externalId,
                IsActive = true,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };
            _dbContext.DoorIos.Add(entity);
            result.Created++;
        }
        else
        {
            var changed = false;
            if (existing.Name != (name ?? externalId)) { existing.Name = name ?? externalId; changed = true; }
            if (existing.IoType != ioType) { existing.IoType = ioType; changed = true; }
            if (existing.Direction != direction) { existing.Direction = direction; changed = true; }

            if (changed)
            {
                existing.UpdatedUtc = DateTime.UtcNow;
                result.Updated++;
            }
            else
            {
                result.Unchanged++;
            }
        }
    }

    private async Task UpsertExtensionAsync(string moduleId, string? controllerExternalId, CancellationToken cancellationToken, SyncResultDto result)
    {
        CompareExtensionAgainstBackend(moduleId, moduleId, controllerExternalId);

        if (string.IsNullOrEmpty(controllerExternalId))
        {
            RecordSkipped(
                result,
                equipmentType: "Extension",
                externalId: moduleId,
                name: moduleId,
                stage: StageValidate,
                category: CategoryMissingRequiredField,
                message: "Extension source record is missing ControllerId.");
            return;
        }

        var controller = await _dbContext.Controllers
            .FirstOrDefaultAsync(c => c.ExternalId == controllerExternalId, cancellationToken);
        if (controller is null)
        {
            RecordFailure(
                result,
                equipmentType: "Extension",
                externalId: moduleId,
                name: moduleId,
                stage: StageMap,
                category: CategoryForeignKeyIssue,
                message: $"Controller '{controllerExternalId}' was not found for extension import.");
            return;
        }

        var existing = await _dbContext.Extensions
            .FirstOrDefaultAsync(e => e.ExternalId == moduleId, cancellationToken);

        if (existing is null)
        {
            var entity = new ExtensionEntity
            {
                ExternalId = moduleId,
                ControllerId = controller.Id,
                Name = moduleId,
                IsActive = true,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };
            _dbContext.Extensions.Add(entity);
            result.Created++;
        }
        else
        {
            if (existing.ControllerId != controller.Id)
            {
                RecordFailure(
                    result,
                    equipmentType: "Extension",
                    externalId: moduleId,
                    name: moduleId,
                    stage: StageUpdate,
                    category: CategoryDuplicateConflict,
                    message: $"Extension '{moduleId}' already exists with a different controller mapping.");
                return;
            }

            result.Unchanged++;
        }
    }

    private async Task ImportDoorInputsPagedAsync(CancellationToken cancellationToken, SyncResultDto result)
    {
        var skip = 0;
        var batchIndex = 0;
        var processed = 0;
        int? totalCount = null;

        while (!cancellationToken.IsCancellationRequested)
        {
            batchIndex++;
            _logger.LogInformation("Door IO (input) batch {Batch} started. Skip={Skip}, Top={Top}", batchIndex, skip, _batchSize);

            var (inputsPage, count) = await _apiClient.GetInputsPagedAsync(skip, _batchSize, cancellationToken);
            totalCount ??= count;

            if (inputsPage.Count == 0)
            {
                _logger.LogInformation("Door IO (input) batch {Batch} returned no records; stopping paging loop", batchIndex);
                break;
            }

            result.TotalReceived += inputsPage.Count;

            foreach (var input in inputsPage)
            {
                if (!string.IsNullOrEmpty(input.ModuleId))
                {
                    continue;
                }

                await ProcessRecordAsync(
                    result,
                    equipmentType: "DoorIo",
                    externalId: input.Id,
                    name: input.Name,
                    cancellationToken,
                    (token, syncResult) => UpsertDoorIoAsync(input.Id, input.ControllerId, input.Name, input.InputType ?? "Input", "Input", token, syncResult),
                    defaultStage: StageMap);
            }

            processed += inputsPage.Count;
            skip += inputsPage.Count;

            _logger.LogInformation(
                "Door IO (input) batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                batchIndex,
                inputsPage.Count,
                processed,
                totalCount);

            if (inputsPage.Count < _batchSize)
            {
                break;
            }
        }
    }

    private async Task ImportDoorOutputsPagedAsync(CancellationToken cancellationToken, SyncResultDto result)
    {
        var skip = 0;
        var batchIndex = 0;
        var processed = 0;
        int? totalCount = null;

        while (!cancellationToken.IsCancellationRequested)
        {
            batchIndex++;
            _logger.LogInformation("Door IO (output) batch {Batch} started. Skip={Skip}, Top={Top}", batchIndex, skip, _batchSize);

            var (outputsPage, count) = await _apiClient.GetOutputsPagedAsync(skip, _batchSize, cancellationToken);
            totalCount ??= count;

            if (outputsPage.Count == 0)
            {
                _logger.LogInformation("Door IO (output) batch {Batch} returned no records; stopping paging loop", batchIndex);
                break;
            }

            result.TotalReceived += outputsPage.Count;

            foreach (var output in outputsPage)
            {
                if (!string.IsNullOrEmpty(output.ModuleId))
                {
                    continue;
                }

                await ProcessRecordAsync(
                    result,
                    equipmentType: "DoorIo",
                    externalId: output.Id,
                    name: output.Name,
                    cancellationToken,
                    (token, syncResult) => UpsertDoorIoAsync(output.Id, output.ControllerId, output.Name, output.OutputType ?? "Output", "Output", token, syncResult),
                    defaultStage: StageMap);
            }

            processed += outputsPage.Count;
            skip += outputsPage.Count;

            _logger.LogInformation(
                "Door IO (output) batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                batchIndex,
                outputsPage.Count,
                processed,
                totalCount);

            if (outputsPage.Count < _batchSize)
            {
                break;
            }
        }
    }

    private async Task ProcessExtensionSourceInputsAsync(
        CancellationToken cancellationToken,
        SyncResultDto result,
        HashSet<string> seenModules)
    {
        var skip = 0;
        var batchIndex = 0;
        var processed = 0;
        int? totalCount = null;

        while (!cancellationToken.IsCancellationRequested)
        {
            batchIndex++;
            _logger.LogInformation("Extension/input batch {Batch} started. Skip={Skip}, Top={Top}", batchIndex, skip, _batchSize);

            var (inputsPage, count) = await _apiClient.GetInputsPagedAsync(skip, _batchSize, cancellationToken);
            totalCount ??= count;

            if (inputsPage.Count == 0)
            {
                _logger.LogInformation("Extension/input batch {Batch} returned no records; stopping paging loop", batchIndex);
                break;
            }

            result.TotalReceived += inputsPage.Count;

            foreach (var input in inputsPage)
            {
                if (string.IsNullOrEmpty(input.ModuleId))
                {
                    continue;
                }

                var moduleKey = BuildModuleKey(input.ModuleId, input.ControllerId);
                if (!seenModules.Add(moduleKey))
                {
                    continue;
                }

                await ProcessRecordAsync(
                    result,
                    equipmentType: "Extension",
                    externalId: input.ModuleId,
                    name: input.ModuleId,
                    cancellationToken,
                    (token, syncResult) => UpsertExtensionAsync(input.ModuleId, input.ControllerId, token, syncResult),
                    defaultStage: StageMap);
            }

            foreach (var input in inputsPage)
            {
                if (string.IsNullOrEmpty(input.ModuleId))
                {
                    continue;
                }

                await ProcessRecordAsync(
                    result,
                    equipmentType: "ExtensionIo",
                    externalId: input.Id,
                    name: input.Name,
                    cancellationToken,
                    (token, syncResult) => UpsertExtensionIoAsync(input.Id, input.ModuleId, input.ControllerId, input.Name, input.InputType ?? "Input", "Input", token, syncResult),
                    defaultStage: StageMap);
            }

            processed += inputsPage.Count;
            skip += inputsPage.Count;

            _logger.LogInformation(
                "Extension/input batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                batchIndex,
                inputsPage.Count,
                processed,
                totalCount);

            if (inputsPage.Count < _batchSize)
            {
                break;
            }
        }
    }

    private async Task ProcessExtensionSourceOutputsAsync(
        CancellationToken cancellationToken,
        SyncResultDto result,
        HashSet<string> seenModules)
    {
        var skip = 0;
        var batchIndex = 0;
        var processed = 0;
        int? totalCount = null;

        while (!cancellationToken.IsCancellationRequested)
        {
            batchIndex++;
            _logger.LogInformation("Extension/output batch {Batch} started. Skip={Skip}, Top={Top}", batchIndex, skip, _batchSize);

            var (outputsPage, count) = await _apiClient.GetOutputsPagedAsync(skip, _batchSize, cancellationToken);
            totalCount ??= count;

            if (outputsPage.Count == 0)
            {
                _logger.LogInformation("Extension/output batch {Batch} returned no records; stopping paging loop", batchIndex);
                break;
            }

            result.TotalReceived += outputsPage.Count;

            foreach (var output in outputsPage)
            {
                if (string.IsNullOrEmpty(output.ModuleId))
                {
                    continue;
                }

                var moduleKey = BuildModuleKey(output.ModuleId, output.ControllerId);
                if (!seenModules.Add(moduleKey))
                {
                    continue;
                }

                await ProcessRecordAsync(
                    result,
                    equipmentType: "Extension",
                    externalId: output.ModuleId,
                    name: output.ModuleId,
                    cancellationToken,
                    (token, syncResult) => UpsertExtensionAsync(output.ModuleId, output.ControllerId, token, syncResult),
                    defaultStage: StageMap);
            }

            foreach (var output in outputsPage)
            {
                if (string.IsNullOrEmpty(output.ModuleId))
                {
                    continue;
                }

                await ProcessRecordAsync(
                    result,
                    equipmentType: "ExtensionIo",
                    externalId: output.Id,
                    name: output.Name,
                    cancellationToken,
                    (token, syncResult) => UpsertExtensionIoAsync(output.Id, output.ModuleId, output.ControllerId, output.Name, output.OutputType ?? "Output", "Output", token, syncResult),
                    defaultStage: StageMap);
            }

            processed += outputsPage.Count;
            skip += outputsPage.Count;

            _logger.LogInformation(
                "Extension/output batch {Batch} completed. BatchProcessed={BatchProcessed}, CumulativeProcessed={CumulativeProcessed}, Total={Total}",
                batchIndex,
                outputsPage.Count,
                processed,
                totalCount);

            if (outputsPage.Count < _batchSize)
            {
                break;
            }
        }
    }

    private async Task UpsertExtensionIoAsync(string externalId, string extensionExternalId, string? controllerExternalId, string? name, string ioType, string direction, CancellationToken cancellationToken, SyncResultDto result)
    {
        CompareExtensionIoAgainstBackend(externalId, name, ioType, direction, extensionExternalId, controllerExternalId);

        if (string.IsNullOrEmpty(controllerExternalId))
        {
            RecordSkipped(
                result,
                equipmentType: "ExtensionIo",
                externalId: externalId,
                name: name,
                stage: StageValidate,
                category: CategoryMissingRequiredField,
                message: "Extension IO record is missing ControllerId.");
            return;
        }

        var controller = await _dbContext.Controllers
            .FirstOrDefaultAsync(c => c.ExternalId == controllerExternalId, cancellationToken);
        if (controller is null)
        {
            RecordFailure(
                result,
                equipmentType: "ExtensionIo",
                externalId: externalId,
                name: name,
                stage: StageMap,
                category: CategoryForeignKeyIssue,
                message: $"Controller '{controllerExternalId}' was not found for extension IO import.");
            return;
        }

        var extension = await _dbContext.Extensions
            .FirstOrDefaultAsync(e => e.ExternalId == extensionExternalId, cancellationToken);
        if (extension is null)
        {
            RecordFailure(
                result,
                equipmentType: "ExtensionIo",
                externalId: externalId,
                name: name,
                stage: StageMap,
                category: CategoryForeignKeyIssue,
                message: $"Extension '{extensionExternalId}' was not found for extension IO import.");
            return;
        }

        if (extension.ControllerId != controller.Id)
        {
            RecordFailure(
                result,
                equipmentType: "ExtensionIo",
                externalId: externalId,
                name: name,
                stage: StageMap,
                category: CategoryDuplicateConflict,
                message: $"Extension '{extensionExternalId}' is mapped to a different controller than '{controllerExternalId}'.");
            return;
        }

        var existing = await _dbContext.ExtensionIos
            .FirstOrDefaultAsync(io => io.ExternalId == externalId, cancellationToken);

        if (existing is null)
        {
            var entity = new ExtensionIoEntity
            {
                ExternalId = externalId,
                ExtensionId = extension.Id,
                ControllerId = controller.Id,
                IoType = ioType,
                Direction = direction,
                Name = name ?? externalId,
                IsActive = true,
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };
            _dbContext.ExtensionIos.Add(entity);
            result.Created++;
        }
        else
        {
            var changed = false;
            if (existing.Name != (name ?? externalId)) { existing.Name = name ?? externalId; changed = true; }
            if (existing.IoType != ioType) { existing.IoType = ioType; changed = true; }
            if (existing.Direction != direction) { existing.Direction = direction; changed = true; }

            if (changed)
            {
                existing.UpdatedUtc = DateTime.UtcNow;
                result.Updated++;
            }
            else
            {
                result.Unchanged++;
            }
        }
    }

    private static string BuildModuleKey(string moduleId, string? controllerExternalId)
    {
        return $"{moduleId}|{controllerExternalId ?? string.Empty}";
    }

    private async Task ProcessRecordAsync(
        SyncResultDto result,
        string equipmentType,
        string? externalId,
        string? name,
        CancellationToken cancellationToken,
        Func<CancellationToken, SyncResultDto, Task> upsert,
        string defaultStage)
    {
        if (string.IsNullOrWhiteSpace(externalId))
        {
            RecordSkipped(
                result,
                equipmentType,
                externalId,
                name,
                StageValidate,
                CategoryMissingRequiredField,
                "Source record is missing required external ID.");
            return;
        }

        var before = Snapshot(result);

        try
        {
            await upsert(cancellationToken, result);

            var delta = GetSuccessfulDelta(before, result);
            if (delta <= 0)
            {
                _dbContext.ChangeTracker.Clear();
                return;
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            result.Succeeded += delta;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (DbUpdateException ex)
        {
            RestoreSnapshot(result, before);
            RecordFailure(
                result,
                equipmentType,
                externalId,
                name,
                StageSave,
                ClassifyDbFailure(ex),
                ex.Message,
                ex);
        }
        catch (FormatException ex)
        {
            RestoreSnapshot(result, before);
            RecordFailure(
                result,
                equipmentType,
                externalId,
                name,
                defaultStage,
                CategoryParsing,
                ex.Message,
                ex);
        }
        catch (InvalidOperationException ex)
        {
            RestoreSnapshot(result, before);
            RecordFailure(
                result,
                equipmentType,
                externalId,
                name,
                defaultStage,
                CategoryUnexpectedApi,
                ex.Message,
                ex);
        }
        catch (Exception ex)
        {
            RestoreSnapshot(result, before);
            RecordFailure(
                result,
                equipmentType,
                externalId,
                name,
                defaultStage,
                CategoryUnhandled,
                ex.Message,
                ex);
        }
        finally
        {
            _dbContext.ChangeTracker.Clear();
        }
    }

    private static (int Created, int Updated, int Unchanged, int Succeeded) Snapshot(SyncResultDto result)
    {
        return (result.Created, result.Updated, result.Unchanged, result.Succeeded);
    }

    private static void RestoreSnapshot(SyncResultDto result, (int Created, int Updated, int Unchanged, int Succeeded) snapshot)
    {
        result.Created = snapshot.Created;
        result.Updated = snapshot.Updated;
        result.Unchanged = snapshot.Unchanged;
        result.Succeeded = snapshot.Succeeded;
    }

    private static int GetSuccessfulDelta((int Created, int Updated, int Unchanged, int Succeeded) before, SyncResultDto after)
    {
        var beforeTotal = before.Created + before.Updated + before.Unchanged;
        var afterTotal = after.Created + after.Updated + after.Unchanged;
        return Math.Max(0, afterTotal - beforeTotal);
    }

    private void RecordSkipped(
        SyncResultDto result,
        string equipmentType,
        string? externalId,
        string? name,
        string stage,
        string category,
        string message,
        Exception? exception = null)
    {
        result.Skipped++;
        RecordFailureDetail(result, equipmentType, externalId, name, stage, category, message, exception);
    }

    private void RecordFailure(
        SyncResultDto result,
        string equipmentType,
        string? externalId,
        string? name,
        string stage,
        string category,
        string message,
        Exception? exception = null)
    {
        result.Failed++;
        RecordFailureDetail(result, equipmentType, externalId, name, stage, category, message, exception);
    }

    private void RecordFailureDetail(
        SyncResultDto result,
        string equipmentType,
        string? externalId,
        string? name,
        string stage,
        string category,
        string message,
        Exception? exception)
    {
        var detail = new ImportFailureDetailDto
        {
            EquipmentType = equipmentType,
            ExternalId = externalId,
            Name = name,
            FailureStage = stage,
            FailureCategory = category,
            Message = message,
            StackTrace = exception?.StackTrace
        };

        result.Failures.Add(detail);

        _logger.LogError(
            exception,
            "{Operation} record failed. EquipmentType={EquipmentType}, ExternalId={ExternalId}, Name={Name}, Stage={Stage}, Category={Category}, Message={Message}",
            result.Operation,
            detail.EquipmentType,
            detail.ExternalId,
            detail.Name,
            detail.FailureStage,
            detail.FailureCategory,
            detail.Message);
    }

    private static string ClassifyDbFailure(DbUpdateException exception)
    {
        var text = $"{exception.Message} {exception.InnerException?.Message}";

        if (text.Contains("FOREIGN KEY", StringComparison.OrdinalIgnoreCase))
        {
            return CategoryForeignKeyIssue;
        }

        if (text.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase)
            || text.Contains("duplicate", StringComparison.OrdinalIgnoreCase)
            || text.Contains("conflict", StringComparison.OrdinalIgnoreCase))
        {
            return CategoryDuplicateConflict;
        }

        if (text.Contains("NULL", StringComparison.OrdinalIgnoreCase)
            || text.Contains("cannot insert null", StringComparison.OrdinalIgnoreCase))
        {
            return CategoryNullValue;
        }

        return CategoryDatabaseSave;
    }

    private static void Accumulate(SyncResultDto total, SyncResultDto partial)
    {
        total.TotalReceived += partial.TotalReceived;
        total.Created += partial.Created;
        total.Updated += partial.Updated;
        total.Unchanged += partial.Unchanged;
        total.Succeeded += partial.Succeeded;
        total.Skipped += partial.Skipped;
        total.Failed += partial.Failed;
        total.Failures.AddRange(partial.Failures);
        if (!partial.Success && partial.ErrorMessage is not null)
        {
            total.ErrorMessage = total.ErrorMessage is null
                ? partial.ErrorMessage
                : $"{total.ErrorMessage}; {partial.ErrorMessage}";
        }
    }

    private void CompareControllerAgainstBackend(string externalId, string? name, bool? isActive)
    {
        if (!TryGetStartupSnapshot(out var snapshot))
        {
            return;
        }

        if (!snapshot.ControllersByExternalId.TryGetValue(externalId, out var central))
        {
            _logger.LogWarning("Backend comparison: controller {ExternalId} missing in central data", externalId);
            return;
        }

        var nameMatches = string.Equals(central.Name ?? externalId, name ?? externalId, StringComparison.Ordinal);
        var activeMatches = !isActive.HasValue || !central.IsActive.HasValue || central.IsActive.Value == isActive.Value;

        if (!nameMatches || !activeMatches)
        {
            _logger.LogInformation(
                "Backend comparison mismatch for controller {ExternalId}. BackendName: {BackendName}, AmadeusName: {AmadeusName}, BackendIsActive: {BackendIsActive}, AmadeusIsActive: {AmadeusIsActive}",
                externalId,
                central.Name,
                name,
                central.IsActive,
                isActive);
            return;
        }

        _logger.LogDebug("Backend comparison matched for controller {ExternalId}", externalId);
    }

    private void CompareDoorAgainstBackend(string externalId, string? name, string? controllerExternalId)
    {
        if (!TryGetStartupSnapshot(out var snapshot))
        {
            return;
        }

        if (!snapshot.DoorsByExternalId.TryGetValue(externalId, out var central))
        {
            _logger.LogWarning("Backend comparison: door {ExternalId} missing in central data", externalId);
            return;
        }

        var nameMatches = string.Equals(central.Name ?? externalId, name ?? externalId, StringComparison.Ordinal);
        var controllerMatches = string.IsNullOrWhiteSpace(controllerExternalId)
            || string.IsNullOrWhiteSpace(central.ControllerExternalId)
            || string.Equals(central.ControllerExternalId, controllerExternalId, StringComparison.OrdinalIgnoreCase);

        if (!nameMatches || !controllerMatches)
        {
            _logger.LogInformation(
                "Backend comparison mismatch for door {ExternalId}. BackendName: {BackendName}, AmadeusName: {AmadeusName}, BackendController: {BackendController}, AmadeusController: {AmadeusController}",
                externalId,
                central.Name,
                name,
                central.ControllerExternalId,
                controllerExternalId);
            return;
        }

        _logger.LogDebug("Backend comparison matched for door {ExternalId}", externalId);
    }

    private void CompareDoorIoAgainstBackend(string externalId, string? name, string? ioType, string? direction, string? controllerExternalId)
    {
        if (!TryGetStartupSnapshot(out var snapshot))
        {
            return;
        }

        if (!snapshot.DoorIosByExternalId.TryGetValue(externalId, out var central))
        {
            _logger.LogWarning("Backend comparison: door IO {ExternalId} missing in central data", externalId);
            return;
        }

        var nameMatches = string.Equals(central.Name ?? externalId, name ?? externalId, StringComparison.Ordinal);
        var typeMatches = string.IsNullOrWhiteSpace(ioType)
            || string.IsNullOrWhiteSpace(central.IoType)
            || string.Equals(central.IoType, ioType, StringComparison.OrdinalIgnoreCase);
        var directionMatches = string.IsNullOrWhiteSpace(direction)
            || string.IsNullOrWhiteSpace(central.Direction)
            || string.Equals(central.Direction, direction, StringComparison.OrdinalIgnoreCase);
        var controllerMatches = string.IsNullOrWhiteSpace(controllerExternalId)
            || string.IsNullOrWhiteSpace(central.ControllerExternalId)
            || string.Equals(central.ControllerExternalId, controllerExternalId, StringComparison.OrdinalIgnoreCase);

        if (!nameMatches || !typeMatches || !directionMatches || !controllerMatches)
        {
            _logger.LogInformation(
                "Backend comparison mismatch for door IO {ExternalId}. Backend(Name/Type/Direction/Controller)=({BackendName}/{BackendType}/{BackendDirection}/{BackendController}) Amadeus=({AmadeusName}/{AmadeusType}/{AmadeusDirection}/{AmadeusController})",
                externalId,
                central.Name,
                central.IoType,
                central.Direction,
                central.ControllerExternalId,
                name,
                ioType,
                direction,
                controllerExternalId);
            return;
        }

        _logger.LogDebug("Backend comparison matched for door IO {ExternalId}", externalId);
    }

    private void CompareExtensionAgainstBackend(string externalId, string? name, string? controllerExternalId)
    {
        if (!TryGetStartupSnapshot(out var snapshot))
        {
            return;
        }

        if (!snapshot.ExtensionsByExternalId.TryGetValue(externalId, out var central))
        {
            _logger.LogWarning("Backend comparison: extension {ExternalId} missing in central data", externalId);
            return;
        }

        var nameMatches = string.Equals(central.Name ?? externalId, name ?? externalId, StringComparison.Ordinal);
        var controllerMatches = string.IsNullOrWhiteSpace(controllerExternalId)
            || string.IsNullOrWhiteSpace(central.ControllerExternalId)
            || string.Equals(central.ControllerExternalId, controllerExternalId, StringComparison.OrdinalIgnoreCase);

        if (!nameMatches || !controllerMatches)
        {
            _logger.LogInformation(
                "Backend comparison mismatch for extension {ExternalId}. BackendName: {BackendName}, AmadeusName: {AmadeusName}, BackendController: {BackendController}, AmadeusController: {AmadeusController}",
                externalId,
                central.Name,
                name,
                central.ControllerExternalId,
                controllerExternalId);
            return;
        }

        _logger.LogDebug("Backend comparison matched for extension {ExternalId}", externalId);
    }

    private void CompareExtensionIoAgainstBackend(string externalId, string? name, string? ioType, string? direction, string? extensionExternalId, string? controllerExternalId)
    {
        if (!TryGetStartupSnapshot(out var snapshot))
        {
            return;
        }

        if (!snapshot.ExtensionIosByExternalId.TryGetValue(externalId, out var central))
        {
            _logger.LogWarning("Backend comparison: extension IO {ExternalId} missing in central data", externalId);
            return;
        }

        var nameMatches = string.Equals(central.Name ?? externalId, name ?? externalId, StringComparison.Ordinal);
        var typeMatches = string.IsNullOrWhiteSpace(ioType)
            || string.IsNullOrWhiteSpace(central.IoType)
            || string.Equals(central.IoType, ioType, StringComparison.OrdinalIgnoreCase);
        var directionMatches = string.IsNullOrWhiteSpace(direction)
            || string.IsNullOrWhiteSpace(central.Direction)
            || string.Equals(central.Direction, direction, StringComparison.OrdinalIgnoreCase);
        var extensionMatches = string.IsNullOrWhiteSpace(extensionExternalId)
            || string.IsNullOrWhiteSpace(central.ExtensionExternalId)
            || string.Equals(central.ExtensionExternalId, extensionExternalId, StringComparison.OrdinalIgnoreCase);
        var controllerMatches = string.IsNullOrWhiteSpace(controllerExternalId)
            || string.IsNullOrWhiteSpace(central.ControllerExternalId)
            || string.Equals(central.ControllerExternalId, controllerExternalId, StringComparison.OrdinalIgnoreCase);

        if (!nameMatches || !typeMatches || !directionMatches || !extensionMatches || !controllerMatches)
        {
            _logger.LogInformation(
                "Backend comparison mismatch for extension IO {ExternalId}. Backend(Name/Type/Direction/Extension/Controller)=({BackendName}/{BackendType}/{BackendDirection}/{BackendExtension}/{BackendController}) Amadeus=({AmadeusName}/{AmadeusType}/{AmadeusDirection}/{AmadeusExtension}/{AmadeusController})",
                externalId,
                central.Name,
                central.IoType,
                central.Direction,
                central.ExtensionExternalId,
                central.ControllerExternalId,
                name,
                ioType,
                direction,
                extensionExternalId,
                controllerExternalId);
            return;
        }

        _logger.LogDebug("Backend comparison matched for extension IO {ExternalId}", externalId);
    }

    private bool TryGetStartupSnapshot(out BackendEquipmentSnapshot snapshot)
    {
        snapshot = _backendSnapshotProvider.GetCurrent();

        if (snapshot.LoadedUtc != DateTime.MinValue)
        {
            return true;
        }

        if (!_startupSnapshotMissingLogged)
        {
            _logger.LogWarning(
                "Central backend equipment snapshot was not loaded at startup. Import will continue with local persistence, and backend comparison is skipped.");
            _startupSnapshotMissingLogged = true;
        }

        return false;
    }

    private async Task<bool> EnsureBackendAvailableAsync(SyncResultDto result, CancellationToken cancellationToken)
    {
        if (TryGetStartupSnapshot(out _))
        {
            return true;
        }

        // Snapshot was not loaded at startup — attempt an on-demand refresh
        _logger.LogWarning(
            "{Operation}: backend snapshot missing, attempting on-demand refresh before giving up.",
            result.Operation);

        try
        {
            await _backendSnapshotProvider.EnsureLoadedAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{Operation}: on-demand backend snapshot refresh failed.", result.Operation);
        }

        if (TryGetStartupSnapshot(out _))
        {
            _logger.LogInformation("{Operation}: backend snapshot recovered via on-demand refresh.", result.Operation);
            return true;
        }

        result.Success = false;
        result.CompletedUtc = DateTime.UtcNow;
        result.ErrorMessage = "Backend connection is unavailable. Import was stopped.";

        _logger.LogError(
            "{Operation} was stopped because backend connection is unavailable and startup snapshot was not loaded.",
            result.Operation);

        return false;
    }
}
