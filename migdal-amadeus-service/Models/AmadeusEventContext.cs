using System.Globalization;
using System.Text.Json;

namespace Amadeus8.Models;

/// <summary>
/// Normalized, strongly-typed view of an incoming Amadeus SignalR event payload.
/// Parsed once and shared across the processing pipeline so raw JSON is not
/// re-parsed multiple times.
/// </summary>
public sealed class AmadeusEventContext
{
    /// <summary>Event UID from the "uid" field. Primary deduplication key.</summary>
    public string? EventUid { get; init; }

    /// <summary>Log ID from the "logID" field. Alternative deduplication key when uid is absent.</summary>
    public long? LogId { get; init; }

    /// <summary>Numeric event type code from the "type" field.</summary>
    public int? EventTypeCode { get; init; }

    /// <summary>Event date/time from the "dateTime" field (may be local time from Amadeus).</summary>
    public DateTime? EventDateTime { get; init; }

    /// <summary>
    /// Reader UID (GUID string) from the "readerUID" field.
    /// Primary equipment identifier for access and IO events.
    /// </summary>
    public string? ReaderUid { get; init; }

    /// <summary>Controller UID from the "controllerUID" field.</summary>
    public string? ControllerUid { get; init; }

    /// <summary>Input UID from the "inputUID" field or first InputStatuses key.</summary>
    public string? InputUid { get; init; }

    /// <summary>Output UID from the "outputUID" field or first OutputStatuses key.</summary>
    public string? OutputUid { get; init; }

    /// <summary>First input status code from InputStatuses, when available.</summary>
    public int? InputStatusCode { get; init; }

    /// <summary>First output status code from OutputStatuses, when available.</summary>
    public int? OutputStatusCode { get; init; }

    /// <summary>Human-readable reader name from the "readerName" field.</summary>
    public string? ReaderName { get; init; }

    /// <summary>Cardholder UID from the "cardholderUID" field.</summary>
    public string? CardholderUid { get; init; }

    /// <summary>Cardholder first name from the "cardholderFirstName" field.</summary>
    public string? CardholderFirstName { get; init; }

    /// <summary>Cardholder last name from the "cardholderLastName" field.</summary>
    public string? CardholderLastName { get; init; }

    /// <summary>Card code from the "cardCode" field.</summary>
    public string? CardCode { get; init; }

    /// <summary>Access denied reason code from the "accessDeniedCode" field.</summary>
    public int? AccessDeniedCode { get; init; }

    /// <summary>Reader function code from the "readerFunctionCodes" field.</summary>
    public int? ReaderFunctionCodes { get; init; }

    /// <summary>Car registration number from the "carRegistrationNum" field.</summary>
    public string? CarRegistrationNum { get; init; }

    /// <summary>
    /// The SignalR method name that delivered the event
    /// (e.g. "AccessEventArrived", "IOEventArrived", "AlarmEventArrived").
    /// </summary>
    public string SignalRMethodName { get; init; } = string.Empty;

    /// <summary>
    /// Attempts to parse an <see cref="AmadeusEventContext"/> from a raw Amadeus JSON payload.
    /// Returns <c>null</c> if the payload is null/empty or the JSON is malformed.
    /// </summary>
    public static AmadeusEventContext? TryParse(string? rawJson, string signalRMethodName)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            var root = doc.RootElement;

            return new AmadeusEventContext
            {
                SignalRMethodName = signalRMethodName,
                EventUid        = TryGetString(root, "uid"),
                LogId           = TryGetLong(root, "logID"),
                EventTypeCode   = TryGetInt(root, "type"),
                EventDateTime   = TryGetDateTime(root, "dateTime"),
                ReaderUid       = TryGetString(root, "readerUID"),
                ControllerUid   = TryGetString(root, "controllerUID"),
                InputUid        = TryGetString(root, "inputUID")
                                    ?? TryGetFirstObjectPropertyName(root, "InputStatuses"),
                OutputUid       = TryGetString(root, "outputUID")
                                    ?? TryGetFirstObjectPropertyName(root, "OutputStatuses"),
                InputStatusCode = TryGetFirstObjectPropertyIntValue(root, "InputStatuses"),
                OutputStatusCode = TryGetFirstObjectPropertyIntValue(root, "OutputStatuses"),
                ReaderName      = TryGetString(root, "readerName"),
                CardholderUid   = TryGetString(root, "cardholderUID"),
                CardholderFirstName = TryGetString(root, "cardholderFirstName"),
                CardholderLastName = TryGetString(root, "cardholderLastName"),
                CardCode        = TryGetString(root, "cardCode"),
                AccessDeniedCode = TryGetInt(root, "accessDeniedCode"),
                ReaderFunctionCodes = TryGetInt(root, "readerFunctionCodes"),
                CarRegistrationNum = TryGetString(root, "carRegistrationNum")
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static string? TryGetString(JsonElement element, string propertyName)
    {
        if (TryGetPropertyIgnoreCase(element, propertyName, out var value) &&
            value.ValueKind == JsonValueKind.String)
        {
            return value.GetString();
        }
        return null;
    }

    private static long? TryGetLong(JsonElement element, string propertyName)
    {
        if (TryGetPropertyIgnoreCase(element, propertyName, out var value) &&
            value.TryGetInt64(out var n))
        {
            return n;
        }
        return null;
    }

    private static int? TryGetInt(JsonElement element, string propertyName)
    {
        if (TryGetPropertyIgnoreCase(element, propertyName, out var value) &&
            value.TryGetInt32(out var n))
        {
            return n;
        }
        return null;
    }

    private static DateTime? TryGetDateTime(JsonElement element, string propertyName)
    {
        if (TryGetPropertyIgnoreCase(element, propertyName, out var value) &&
            value.ValueKind == JsonValueKind.String)
        {
            var str = value.GetString();
            if (DateTime.TryParse(str, CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind, out var dt))
            {
                return dt;
            }
        }
        return null;
    }

    private static string? TryGetFirstObjectPropertyName(JsonElement element, string propertyName)
    {
        if (!TryGetPropertyIgnoreCase(element, propertyName, out var value) ||
            value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (var property in value.EnumerateObject())
        {
            return property.Name;
        }

        return null;
    }

    private static int? TryGetFirstObjectPropertyIntValue(JsonElement element, string propertyName)
    {
        if (!TryGetPropertyIgnoreCase(element, propertyName, out var value) ||
            value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (var property in value.EnumerateObject())
        {
            if (property.Value.TryGetInt32(out var direct))
            {
                return direct;
            }

            if (property.Value.ValueKind == JsonValueKind.String &&
                int.TryParse(property.Value.GetString(), out var parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    private static bool TryGetPropertyIgnoreCase(
        JsonElement element,
        string propertyName,
        out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
    }
}
