# Backend API Definitions

## Purpose
This document defines the backend API endpoint contract used by this service.

The single source of truth for backend routes in code is:
- `Services/BackendApiDefinitions.cs`

Backend API client/access layer:
- `Services/BackendApiClient.cs` — sync, equipment reads, and Amadeus event dispatch
- `Services/BackendEquipmentSnapshotProvider.cs` — startup snapshot load

## Design Rules
- Keep all backend endpoint path definitions in `Services/BackendApiDefinitions.cs`.
- Services that call backend APIs must consume definitions from that file.
- Do not duplicate backend endpoint literals in service classes.
- Keep URL composition consistent by using the shared builder in `BackendApiDefinitions`.

## Endpoint Groups

### Sync endpoints
Defined in `BackendApiDefinitions.Sync`:
- `StartupFull` => `/api/sync/full`
- `Controllers` => `/api/sync/controllers`
- `Doors` => `/api/sync/doors`
- `Extensions` => `/api/sync/extensions`
- `AccessGroups` => `/api/sync/access-groups`
- `SecurityGroups` => `/api/sync/security-groups`
- `Cardholders` => `/api/sync/cardholders`

### Resource endpoints
Defined in `BackendApiDefinitions.Resources`:
- `Controllers` => `/api/controllers`
- `Doors` => `/api/doors`
- `DoorIos` => `/api/door-ios`
- `Extensions` => `/api/extensions`
- `ExtensionIos` => `/api/extension-ios`
- `AccessGroups` => `/api/access-groups`
- `SecurityGroups` => `/api/security-groups`
- `Cardholders` => `/api/cardholders`
- `Events` => `/api/events`
- `AmadeusEventIngestion` => `/api/events/amadeus`

## Amadeus Event Dispatch
Active event forwarding uses:
- `IBackendApiClient.SendAmadeusEventsAsync(IReadOnlyCollection<BackendAmadeusEventDto>, CancellationToken)`
- Posts to `BackendApiDefinitions.Resources.AmadeusEventIngestion` (`/api/events/amadeus`).
- Retries up to 3 attempts with 1-second delay between attempts.
- Throws on final failure so callers can persist `ForwardFailed` status.
- Payload type: `DTOs/BackendAmadeusEventDto.cs`.

See also: `docs/event-processing.md` → Event Mapping.

## Startup Central Equipment Load
- On service startup, `BackendEquipmentStartupLoadHostedService` loads equipment snapshots from backend APIs.
- Loaded entities include controllers, doors, door IOs, extensions, and extension IOs.
- Snapshot is assigned for use in import-time comparison logic.
- Failures are logged clearly and do not crash service startup.

## Import-Time Comparison Source
- Equipment import flows compare incoming Amadeus records against backend-provided central snapshot data.
- This service never compares directly against the central database via direct DB connections.
- Incoming Amadeus data is still persisted locally in this service DB.

## URL Composition
Use:
- `BackendApiDefinitions.BuildUrl(baseUrl, relativePath, endpointName)`

Behavior:
- Throws clear `InvalidOperationException` when `baseUrl` is missing.
- Throws clear `InvalidOperationException` when endpoint path is missing.
- Produces normalized URL with exactly one separator slash.

## How To Add A New Backend Endpoint
1. Add the endpoint path constant to the appropriate nested class in `Services/BackendApiDefinitions.cs`.
2. Use that constant from the backend-calling service.
3. Build full URLs through `BackendApiDefinitions.BuildUrl(...)`.
4. Add logging around external call start/failure/success.
5. Update this document with the new endpoint.

## Compatibility And Safety
- Keep existing endpoint paths stable unless backend contract explicitly changed.
- Avoid renaming constants used by existing callers without coordinated refactor.
- Any contract change must be reviewed against backend implementation and deployment configuration.
