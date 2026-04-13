using Amadeus8.Models;

namespace Amadeus8.Services;

/// <summary>
/// Identifies which type of physical equipment produced the event.
/// Extend this enum as new equipment types are added to the system.
/// </summary>
public enum EquipmentKind
{
    Unknown,
    Door,
    Controller,
    DoorIo,
    Extension,
    ExtensionIo
}

/// <summary>
/// The outcome of an equipment resolution attempt for a single incoming event.
/// </summary>
public sealed class EquipmentResolutionResult
{
    /// <summary>Singleton result for use when no matching equipment is found.</summary>
    public static readonly EquipmentResolutionResult NotFound = new()
    {
        IsFound = false,
        IsActive = false,
        EquipmentKind = EquipmentKind.Unknown
    };

    /// <summary>Whether a matching equipment record exists in the local database.</summary>
    public bool IsFound { get; init; }

    /// <summary>Whether the matched equipment is currently marked active (IsActive == true).</summary>
    public bool IsActive { get; init; }

    /// <summary>The category of equipment that was matched.</summary>
    public EquipmentKind EquipmentKind { get; init; }

    /// <summary>The resolved equipment's external identifier (from Amadeus).</summary>
    public string? EquipmentExternalId { get; init; }

    /// <summary>The resolved equipment's display name.</summary>
    public string? EquipmentName { get; init; }

    /// <summary>The resolved controller external identifier when available.</summary>
    public string? ControllerExternalId { get; init; }

    /// <summary>
    /// Convenience property: <c>true</c> only when the event relates to a known,
    /// active piece of equipment and should be forwarded to the backend.
    /// </summary>
    public bool ShouldForward => IsFound && IsActive;
}

/// <summary>
/// Resolves the physical equipment entity associated with an incoming Amadeus event
/// and determines whether the event qualifies to be forwarded to the backend.
/// </summary>
/// <remarks>
/// Resolution is attempted in priority order across all supported equipment types.
/// Add new resolution strategies here as new equipment types are onboarded.
/// </remarks>
public interface IEquipmentResolverService
{
    /// <summary>
    /// Resolves the equipment entity linked to the given event context.
    /// </summary>
    /// <param name="context">Parsed event context extracted from the raw Amadeus payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>
    /// An <see cref="EquipmentResolutionResult"/> describing whether the equipment was found
    /// and whether the event should be forwarded.
    /// </returns>
    Task<EquipmentResolutionResult> ResolveAsync(
        AmadeusEventContext context,
        CancellationToken cancellationToken);
}
