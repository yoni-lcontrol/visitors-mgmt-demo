using Amadeus8.Configurations;
using Amadeus8.Data;
using Amadeus8.DTOs;
using Amadeus8.Entities;
using Amadeus8.Models;
using Amadeus8.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Amadeus8.Tests;

public class VisitorCreationServiceTests
{
    private const string VisitorTypeUid = "visitor-type-uid-001";

    [Fact]
    public async Task CreateVisitorAsync_Success_ReturnsExternalIdAndSyncedStatus()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient
        {
            CreatedCardholder = new AmadeusCardholder
            {
                Id = "amadeus-uid-123",
                FirstName = "John",
                LastName = "Doe",
                CardholderTypeId = VisitorTypeUid,
                Status = "Active"
            }
        };

        var sut = CreateSut(fakeApi, db);

        var dto = new CreateAmadeusVisitorDto
        {
            FirstName = "John",
            LastName = "Doe",
            FromDateValid = DateTime.UtcNow.AddHours(1),
            ToDateValid = DateTime.UtcNow.AddDays(1)
        };

        var result = await sut.CreateVisitorAsync(dto, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("amadeus-uid-123", result.AmadeusExternalId);
        Assert.Equal("Synced", result.SyncStatus);
        Assert.NotNull(result.LastSyncedAtUtc);

        var entity = await db.Cardholders.FirstOrDefaultAsync(c => c.AmadeusUid == "amadeus-uid-123");
        Assert.NotNull(entity);
        Assert.Equal(VisitorTypeUid, entity.CardholderTypeUid);
        Assert.Equal("John", entity.FirstName);
        Assert.Equal("Doe", entity.LastName);
    }

    [Fact]
    public async Task CreateVisitorAsync_MissingVisitorTypeConfig_ReturnsFailure()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient();
        var sut = CreateSut(fakeApi, db, visitorTypeUid: "");

        var dto = new CreateAmadeusVisitorDto
        {
            FirstName = "Jane",
            LastName = "Smith",
            FromDateValid = DateTime.UtcNow.AddHours(1),
            ToDateValid = DateTime.UtcNow.AddDays(1)
        };

        var result = await sut.CreateVisitorAsync(dto, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("Failed", result.SyncStatus);
        Assert.Contains("not configured", result.ErrorMessage);
        Assert.False(result.IsRetryable);
    }

    [Fact]
    public async Task CreateVisitorAsync_MissingFirstName_ReturnsValidationError()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient();
        var sut = CreateSut(fakeApi, db);

        var dto = new CreateAmadeusVisitorDto
        {
            FirstName = "",
            LastName = "Smith",
            FromDateValid = DateTime.UtcNow.AddHours(1),
            ToDateValid = DateTime.UtcNow.AddDays(1)
        };

        var result = await sut.CreateVisitorAsync(dto, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("Failed", result.SyncStatus);
        Assert.Contains("FirstName", result.ErrorMessage);
    }

    [Fact]
    public async Task CreateVisitorAsync_InvalidDateRange_ReturnsValidationError()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient();
        var sut = CreateSut(fakeApi, db);

        var dto = new CreateAmadeusVisitorDto
        {
            FirstName = "John",
            LastName = "Doe",
            FromDateValid = DateTime.UtcNow.AddDays(2),
            ToDateValid = DateTime.UtcNow.AddDays(1)
        };

        var result = await sut.CreateVisitorAsync(dto, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("ToDateValid must be after FromDateValid", result.ErrorMessage);
    }

    [Fact]
    public async Task CreateVisitorAsync_ToDateInPast_ReturnsValidationError()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient();
        var sut = CreateSut(fakeApi, db);

        var dto = new CreateAmadeusVisitorDto
        {
            FirstName = "John",
            LastName = "Doe",
            FromDateValid = DateTime.UtcNow.AddDays(-2),
            ToDateValid = DateTime.UtcNow.AddDays(-1)
        };

        var result = await sut.CreateVisitorAsync(dto, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("future", result.ErrorMessage);
    }

    [Fact]
    public async Task CreateVisitorAsync_DuplicateConflict_ReturnsNonRetryableFailure()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient
        {
            ThrowOnCreate = new HttpRequestException("Cardholder create failed with status Conflict")
        };
        var sut = CreateSut(fakeApi, db);

        var dto = new CreateAmadeusVisitorDto
        {
            FirstName = "John",
            LastName = "Doe",
            FromDateValid = DateTime.UtcNow.AddHours(1),
            ToDateValid = DateTime.UtcNow.AddDays(1)
        };

        var result = await sut.CreateVisitorAsync(dto, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("Failed", result.SyncStatus);
        Assert.Contains("Duplicate", result.ErrorMessage);
        Assert.False(result.IsRetryable);
    }

    [Fact]
    public async Task CreateVisitorAsync_ApiError_ReturnsRetryableFailure()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient
        {
            ThrowOnCreate = new HttpRequestException("Cardholder create failed with status 500")
        };
        var sut = CreateSut(fakeApi, db);

        var dto = new CreateAmadeusVisitorDto
        {
            FirstName = "John",
            LastName = "Doe",
            FromDateValid = DateTime.UtcNow.AddHours(1),
            ToDateValid = DateTime.UtcNow.AddDays(1)
        };

        var result = await sut.CreateVisitorAsync(dto, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("Failed", result.SyncStatus);
        Assert.True(result.IsRetryable);
    }

    [Fact]
    public async Task CreateVisitorAsync_WithOptionalFields_IncludesThemInPayload()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient
        {
            CreatedCardholder = new AmadeusCardholder
            {
                Id = "amadeus-uid-456",
                FirstName = "Jane",
                LastName = "Visitor",
                CardholderTypeId = VisitorTypeUid,
                Status = "Active",
                AccessGroupApiKeys = "ag1,ag2"
            }
        };
        var sut = CreateSut(fakeApi, db);

        var dto = new CreateAmadeusVisitorDto
        {
            FirstName = "Jane",
            LastName = "Visitor",
            FromDateValid = DateTime.UtcNow.AddHours(1),
            ToDateValid = DateTime.UtcNow.AddDays(7),
            AccessGroupApiKeys = new List<string> { "ag1", "ag2" },
            SecurityGroupApiKey = "sg-key-1",
            Notes = "VIP guest",
            DepartmentUid = "dept-uid-1"
        };

        var result = await sut.CreateVisitorAsync(dto, CancellationToken.None);

        Assert.True(result.Success);

        // Verify payload sent to API
        Assert.NotNull(fakeApi.LastCreatePayload);
        var payload = fakeApi.LastCreatePayload as Dictionary<string, object?>;
        Assert.NotNull(payload);
        Assert.Equal(VisitorTypeUid, payload["cardholderTypeUID"]);
        Assert.Equal("Jane", payload["firstName"]);
        Assert.Equal("ag1,ag2", payload["accessGroupApiKeys"]);
        Assert.Equal("sg-key-1", payload["securityGroupApiKey"]);
        Assert.Equal("VIP guest", payload["description"]);
        Assert.Equal("dept-uid-1", payload["departmentUID"]);
    }

    [Fact]
    public async Task DeleteVisitorAsync_Success_MarksDeletedAndReturnsResult()
    {
        var db = CreateDb();
        db.Cardholders.Add(new CardholderEntity
        {
            AmadeusUid = "visitor-uid-1",
            FirstName = "John",
            LastName = "Visitor",
            CardholderTypeUid = VisitorTypeUid,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var fakeApi = new FakeAmadeusApiClient();
        var sut = CreateSut(fakeApi, db);

        var result = await sut.DeleteVisitorAsync("visitor-uid-1", CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("Deleted", result.SyncStatus);
        Assert.Equal("visitor-uid-1", result.AmadeusExternalId);
        Assert.Equal("visitor-uid-1", fakeApi.LastDeletedUid);

        var entity = await db.Cardholders.FirstAsync(c => c.AmadeusUid == "visitor-uid-1");
        Assert.True(entity.IsDeleted);
    }

    [Fact]
    public async Task DeleteVisitorAsync_EmptyUid_ReturnsFailure()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient();
        var sut = CreateSut(fakeApi, db);

        var result = await sut.DeleteVisitorAsync("", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("required", result.ErrorMessage);
    }

    [Fact]
    public async Task DeleteVisitorAsync_NotFound_ReturnsFailure()
    {
        var db = CreateDb();
        var fakeApi = new FakeAmadeusApiClient();
        var sut = CreateSut(fakeApi, db);

        var result = await sut.DeleteVisitorAsync("nonexistent-uid", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("not found", result.ErrorMessage);
    }

    [Fact]
    public async Task DeleteVisitorAsync_NotAVisitor_ReturnsFailure()
    {
        var db = CreateDb();
        db.Cardholders.Add(new CardholderEntity
        {
            AmadeusUid = "employee-uid-1",
            FirstName = "Employee",
            LastName = "Person",
            CardholderTypeUid = "employee-type-uid",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var fakeApi = new FakeAmadeusApiClient();
        var sut = CreateSut(fakeApi, db);

        var result = await sut.DeleteVisitorAsync("employee-uid-1", CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("not a visitor", result.ErrorMessage);
        Assert.Null(fakeApi.LastDeletedUid);
    }

    [Fact]
    public async Task DeleteVisitorAsync_NotFoundInAmadeus_StillMarksDeletedLocally()
    {
        var db = CreateDb();
        db.Cardholders.Add(new CardholderEntity
        {
            AmadeusUid = "visitor-uid-2",
            FirstName = "Gone",
            LastName = "Visitor",
            CardholderTypeUid = VisitorTypeUid,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var fakeApi = new FakeAmadeusApiClient
        {
            ThrowOnDelete = new HttpRequestException("Cardholder delete failed with status 404")
        };
        var sut = CreateSut(fakeApi, db);

        var result = await sut.DeleteVisitorAsync("visitor-uid-2", CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("Deleted", result.SyncStatus);

        var entity = await db.Cardholders.FirstAsync(c => c.AmadeusUid == "visitor-uid-2");
        Assert.True(entity.IsDeleted);
    }

    [Fact]
    public async Task DeleteVisitorAsync_ApiError_ReturnsRetryableFailure()
    {
        var db = CreateDb();
        db.Cardholders.Add(new CardholderEntity
        {
            AmadeusUid = "visitor-uid-3",
            FirstName = "Error",
            LastName = "Visitor",
            CardholderTypeUid = VisitorTypeUid,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var fakeApi = new FakeAmadeusApiClient
        {
            ThrowOnDelete = new HttpRequestException("Cardholder delete failed with status 500")
        };
        var sut = CreateSut(fakeApi, db);

        var result = await sut.DeleteVisitorAsync("visitor-uid-3", CancellationToken.None);

        Assert.False(result.Success);
        Assert.True(result.IsRetryable);
        Assert.Equal("Failed", result.SyncStatus);
    }

    private static AmadeusDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AmadeusDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new AmadeusDbContext(options);
    }

    private static CardholderCommandService CreateSut(
        FakeAmadeusApiClient api,
        AmadeusDbContext db,
        string visitorTypeUid = VisitorTypeUid)
    {
        var amadeusOptions = Options.Create(new AmadeusOptions
        {
            BaseUrl = "http://test",
            Username = "test",
            Password = "test",
            VisitorCardholderTypeUid = visitorTypeUid
        });

        return new CardholderCommandService(
            api,
            db,
            amadeusOptions,
            NullLogger<CardholderCommandService>.Instance);
    }

    private sealed class FakeAmadeusApiClient : IAmadeusApiClient
    {
        public AmadeusCardholder? CreatedCardholder { get; set; }
        public HttpRequestException? ThrowOnCreate { get; set; }
        public HttpRequestException? ThrowOnDelete { get; set; }
        public object? LastCreatePayload { get; private set; }
        public string? LastDeletedUid { get; private set; }

        public Task<AmadeusCardholder> CreateCardholderAsync(object payload, CancellationToken cancellationToken)
        {
            LastCreatePayload = payload;

            if (ThrowOnCreate is not null) throw ThrowOnCreate;

            return Task.FromResult(CreatedCardholder ?? new AmadeusCardholder { Id = "default-uid" });
        }

        public Task DeleteCardholderAsync(string uid, CancellationToken cancellationToken)
        {
            LastDeletedUid = uid;
            if (ThrowOnDelete is not null) throw ThrowOnDelete;
            return Task.CompletedTask;
        }

        public Task<List<AmadeusController>> GetControllersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusController> Items, int? TotalCount)> GetControllersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusReader>> GetReadersAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusReader> Items, int? TotalCount)> GetReadersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusInput>> GetInputsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusInput> Items, int? TotalCount)> GetInputsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusOutput>> GetOutputsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusOutput> Items, int? TotalCount)> GetOutputsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusSecurityGroup>> GetSecurityGroupsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusSecurityGroup> Items, int? TotalCount)> GetSecurityGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusAccessGroup>> GetAccessGroupsAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusAccessGroup> Items, int? TotalCount)> GetAccessGroupsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusCardholder> Items, int? TotalCount)> GetCardholdersPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholder?> GetCardholderByUidAsync(string uid, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholder?> GetCardholderByIdNumberAsync(string cardholderIdNumber, CancellationToken cancellationToken) => Task.FromResult<AmadeusCardholder?>(null);
        public Task UpdateCardholderAsync(string uid, object payload, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholderPersonalDetails?> GetCardholderPersonalDetailsAsync(string cardholderUid, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<AmadeusCardholderPersonalDetails> UpsertLicensePlateAsync(string cardholderUid, string licensePlate, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<(List<AmadeusCard> Items, int? TotalCount)> GetCardsPagedAsync(int skip, int top, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<List<AmadeusCard>> GetCardsByCardholderUidAsync(string cardholderUid, CancellationToken cancellationToken) => throw new NotImplementedException();
    }
}
