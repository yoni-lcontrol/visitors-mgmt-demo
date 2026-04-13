using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Amadeus8.Tests;

public sealed class EventProcessingServiceTests : IDisposable
{
    private readonly AmadeusDbContext _db;

    public EventProcessingServiceTests()
    {
        var options = new DbContextOptionsBuilder<AmadeusDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new AmadeusDbContext(options);
    }

    public void Dispose()
    {
        _db.Dispose();
    }

    [Fact]
    public async Task ProcessEvent_ActiveEquipment_MapsAndForwardsAndPersistsForwardedStatus()
    {
        var resolver = new FakeResolver(new EquipmentResolutionResult
        {
            IsFound = true,
            IsActive = true,
            EquipmentKind = EquipmentKind.Door,
            EquipmentExternalId = "door-1",
            EquipmentName = "Front Door",
            ControllerExternalId = "ctrl-1"
        });

        var mapper = new FakeMapper(
        [
            new BackendAmadeusEventDto
            {
                InternalEventType = "Door.LegalCard",
                IsActive = true,
                RawPayloadJson = "{}",
                SignalRMethod = "AccessEventArrived"
            }
        ]);

        var backend = new FakeBackendApiClient();

        var sut = new EventProcessingService(
            _db,
            resolver,
            mapper,
            backend,
            NullLogger<EventProcessingService>.Instance);

        const string payload = """
            {
              "uid": "event-1",
              "type": 1,
              "readerUID": "reader-1",
              "dateTime": "2026-04-09T08:30:00"
            }
            """;

        await sut.ProcessEventAsync(payload, "AccessEventArrived", CancellationToken.None);

        Assert.Equal(1, backend.DispatchCalls);
        Assert.Single(backend.LastPayload);

        var persisted = await _db.EventLogs.SingleAsync();
        Assert.Equal("Forwarded", persisted.ProcessingStatus);
        Assert.Equal("ctrl-1", persisted.ControllerExternalId);
        Assert.Equal("door-1", persisted.ObjectExternalId);
    }

    [Fact]
    public async Task ProcessEvent_InactiveEquipment_PersistsSkippedInactiveAndDoesNotForward()
    {
        var resolver = new FakeResolver(new EquipmentResolutionResult
        {
            IsFound = true,
            IsActive = false,
            EquipmentKind = EquipmentKind.Door,
            EquipmentExternalId = "door-2",
            EquipmentName = "Back Door",
            ControllerExternalId = "ctrl-2"
        });

        var mapper = new FakeMapper([]);
        var backend = new FakeBackendApiClient();

        var sut = new EventProcessingService(
            _db,
            resolver,
            mapper,
            backend,
            NullLogger<EventProcessingService>.Instance);

        const string payload = """
            {
              "uid": "event-2",
              "type": 2,
              "readerUID": "reader-2"
            }
            """;

        await sut.ProcessEventAsync(payload, "AccessEventArrived", CancellationToken.None);

        Assert.Equal(0, backend.DispatchCalls);

        var persisted = await _db.EventLogs.SingleAsync();
        Assert.Equal("SkippedInactiveEquipment", persisted.ProcessingStatus);
    }

    [Fact]
    public async Task ProcessEvent_InvalidJson_PersistsInvalidJsonFailure()
    {
        var resolver = new FakeResolver(EquipmentResolutionResult.NotFound);
        var mapper = new FakeMapper([]);
        var backend = new FakeBackendApiClient();

        var sut = new EventProcessingService(
            _db,
            resolver,
            mapper,
            backend,
            NullLogger<EventProcessingService>.Instance);

        await sut.ProcessEventAsync("not-json", "AccessEventArrived", CancellationToken.None);

        Assert.Equal(0, backend.DispatchCalls);

        var persisted = await _db.EventLogs.SingleAsync();
        Assert.Equal("InvalidJson", persisted.ProcessingStatus);
        Assert.Equal("JSON parse failed", persisted.ProcessingError);
    }

    private sealed class FakeResolver : IEquipmentResolverService
    {
        private readonly EquipmentResolutionResult _result;

        public FakeResolver(EquipmentResolutionResult result)
        {
            _result = result;
        }

        public Task<EquipmentResolutionResult> ResolveAsync(
            Amadeus8.Models.AmadeusEventContext context,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(_result);
        }
    }

    private sealed class FakeMapper : IAmadeusEventMappingService
    {
        private readonly IReadOnlyList<BackendAmadeusEventDto> _events;

        public FakeMapper(IReadOnlyList<BackendAmadeusEventDto> events)
        {
            _events = events;
        }

        public IReadOnlyList<BackendAmadeusEventDto> Map(
            Amadeus8.Models.AmadeusEventContext context,
            EquipmentResolutionResult resolution,
            string rawPayloadJson,
            DateTime receivedUtc)
        {
            return _events;
        }
    }

    private sealed class FakeBackendApiClient : IBackendApiClient
    {
        public int DispatchCalls { get; private set; }

        public IReadOnlyCollection<BackendAmadeusEventDto> LastPayload { get; private set; } = [];

        public Task<SyncResultDto> TriggerFullSyncAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new SyncResultDto());
        }

        public Task<List<BackendControllerDto>> GetControllersAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new List<BackendControllerDto>());
        }

        public Task<List<BackendDoorDto>> GetDoorsAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new List<BackendDoorDto>());
        }

        public Task<List<BackendDoorIoDto>> GetDoorIosAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new List<BackendDoorIoDto>());
        }

        public Task<List<BackendExtensionDto>> GetExtensionsAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new List<BackendExtensionDto>());
        }

        public Task<List<BackendExtensionIoDto>> GetExtensionIosAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(new List<BackendExtensionIoDto>());
        }

        public Task SendAmadeusEventsAsync(
            IReadOnlyCollection<BackendAmadeusEventDto> events,
            CancellationToken cancellationToken)
        {
            DispatchCalls++;
            LastPayload = events;
            return Task.CompletedTask;
        }
    }
}
