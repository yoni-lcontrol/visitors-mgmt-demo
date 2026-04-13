using Amadeus8.Models;
using Amadeus8.Services;

namespace Amadeus8.Tests;

/// <summary>
/// Unit tests for <see cref="AmadeusEventContext.TryParse"/>.
/// </summary>
public sealed class AmadeusEventContextTests
{
    private const string SampleAccessEvent = """
        {
          "accessDeniedCode": 1024,
          "cardCode": "05555399",
          "cardholderFirstName": null,
          "cardholderIdNumber": null,
          "cardholderLastName": null,
          "cardholderUID": "00000000-0000-0000-0000-000000000000",
          "dateTime": "2026-04-06T09:53:19",
          "logID": 21459,
          "readerFunctionCodes": 1,
          "readerName": "New Controller_Reader2",
          "readerUID": "21ac047a-4598-40d2-80fc-115874a4293b",
          "transactionCode": 0,
          "type": 2,
          "uid": "a146bfb8-19f9-4c80-a9a7-ba3e9599fc3c"
        }
        """;

    // ── TryParse: success cases ───────────────────────────────────────────────

    [Fact]
    public void TryParse_WithValidAccessEvent_ParsesAllFields()
    {
        var result = AmadeusEventContext.TryParse(SampleAccessEvent, "AccessEventArrived");

        Assert.NotNull(result);
        Assert.Equal("AccessEventArrived",                      result.SignalRMethodName);
        Assert.Equal("a146bfb8-19f9-4c80-a9a7-ba3e9599fc3c",  result.EventUid);
        Assert.Equal(21459L,                                    result.LogId);
        Assert.Equal(2,                                         result.EventTypeCode);
        Assert.Equal("21ac047a-4598-40d2-80fc-115874a4293b",  result.ReaderUid);
        Assert.Equal("New Controller_Reader2",                  result.ReaderName);
        Assert.Equal("05555399",                                result.CardCode);
        Assert.Equal("00000000-0000-0000-0000-000000000000",   result.CardholderUid);
        Assert.NotNull(result.EventDateTime);
    }

    [Fact]
    public void TryParse_WithMinimalPayload_ReturnsContextWithNulls()
    {
        const string minimalJson = """{"type": 5}""";

        var result = AmadeusEventContext.TryParse(minimalJson, "GeneralEventArrived");

        Assert.NotNull(result);
        Assert.Equal(5, result.EventTypeCode);
        Assert.Null(result.EventUid);
        Assert.Null(result.ReaderUid);
        Assert.Null(result.LogId);
    }

    // ── TryParse: failure / edge cases ───────────────────────────────────────

    [Fact]
    public void TryParse_WithNullInput_ReturnsNull()
    {
        var result = AmadeusEventContext.TryParse(null, "IOEventArrived");
        Assert.Null(result);
    }

    [Fact]
    public void TryParse_WithEmptyString_ReturnsNull()
    {
        var result = AmadeusEventContext.TryParse(string.Empty, "IOEventArrived");
        Assert.Null(result);
    }

    [Fact]
    public void TryParse_WithWhitespaceOnly_ReturnsNull()
    {
        var result = AmadeusEventContext.TryParse("   ", "IOEventArrived");
        Assert.Null(result);
    }

    [Fact]
    public void TryParse_WithInvalidJson_ReturnsNull()
    {
        var result = AmadeusEventContext.TryParse("not-json-at-all", "AlarmEventArrived");
        Assert.Null(result);
    }

    [Fact]
    public void TryParse_WithPartiallyBrokenJson_ReturnsNull()
    {
        var result = AmadeusEventContext.TryParse("""{"uid": "abc", """, "AlarmEventArrived");
        Assert.Null(result);
    }

    // ── SignalRMethodName is always preserved ─────────────────────────────────

    [Fact]
    public void TryParse_MethodNameIsAlwaysStoredOnContext()
    {
        var result = AmadeusEventContext.TryParse("""{"type":1}""", "TechnicalEventArrived");
        Assert.NotNull(result);
        Assert.Equal("TechnicalEventArrived", result.SignalRMethodName);
    }

    // ── ShouldForward is derived, not stored ──────────────────────────────────

    [Fact]
    public void ResolutionResult_ShouldForward_IsTrueOnlyWhenFoundAndActive()
    {
        var found_active   = new EquipmentResolutionResult { IsFound = true,  IsActive = true  };
        var found_inactive = new EquipmentResolutionResult { IsFound = true,  IsActive = false };
        var notFound       = EquipmentResolutionResult.NotFound;

        Assert.True(found_active.ShouldForward);
        Assert.False(found_inactive.ShouldForward);
        Assert.False(notFound.ShouldForward);
    }
}
