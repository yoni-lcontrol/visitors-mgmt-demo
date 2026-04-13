# Event Processing

## Goal
Process incoming Amadeus push events safely and persist them in the local database.

## Principles
- never trust the payload blindly
- validate before storing
- log processing lifecycle
- avoid duplicate storage where practical
- preserve enough raw data for diagnostics
- keep the processing flow deterministic

## Processing Pipeline
1. Receive raw JSON payload from `AmadeusSignalRClient` via method name.
2. Parse into `AmadeusEventContext` — includes uid, logID, type, dateTime, readerUID, controllerUID, inputUID, outputUID, IO status codes, accessDeniedCode, readerFunctionCodes, cardCode, carRegistrationNum.
3. Deduplicate by `ExternalEventId` (uid or logID) — skip if already stored.
4. Resolve physical equipment via `IEquipmentResolverService` — resolution order:
   - readerUID → `Door.ReaderExternalId`
   - readerUID → `Door.ExternalId` (fallback)
   - inputUID / outputUID → `DoorIo.ExternalId`
   - inputUID / outputUID → `ExtensionIo.ExternalId`
   - controllerUID → `Controller.ExternalId`
5. Determine processing status:
   - `SkippedEquipmentNotFound` — no matching entity found
   - `SkippedInactiveEquipment` — entity or parent inactive
   - `ReadyToForward` — equipment found and active
6. Persist `EventLogEntity` with controller and object external IDs, processing status, raw payload.
7. If `ShouldForward == false`, stop.
8. Map to `BackendAmadeusEventDto` list via `IAmadeusEventMappingService` (event-family-specific logic).
9. Dispatch to backend via `IBackendApiClient.SendAmadeusEventsAsync` (up to 3 retries).
10. Update `EventLogEntity.ProcessingStatus` to `Forwarded` or `ForwardFailed`.

## Stored Fields
Table `EventLogs` stores per event:
- `Id` — internal primary key
- `SourceSystem` — always `"Amadeus8"`
- `ExternalEventId` — uid or logID (dedup key)
- `EventType` — numeric type code from payload
- `EventCategory` — SignalR method name (e.g. `AccessEventArrived`)
- `SourceEventUtc` — event timestamp from Amadeus (stored as UTC)
- `ReceivedUtc` — wall-clock time the service received the event
- `ControllerExternalId` — resolved from equipment lookup
- `ObjectExternalId` — resolved equipment external ID or input/output UID
- `RawPayloadJson` — full JSON payload for diagnostics and replay
- `ProcessingStatus` — one of: `InvalidJson`, `SkippedEquipmentNotFound`, `SkippedInactiveEquipment`, `ReadyToForward`, `SkippedMapping`, `Forwarded`, `ForwardFailed`
- `ProcessingError` — truncated error message on failure (max 2 048 chars)

## Deduplication Strategy
If the vendor exposes a stable event identifier, prefer deduplication by:
- external event ID
- source system

If no stable event ID exists, use a safer fallback combination such as:
- event type
- source object ID
- source event timestamp
- payload checksum

Keep deduplication conservative to avoid dropping legitimate repeated events.

## Error Handling
- A bad event must not crash the listener — `AmadeusSignalRClient.ProcessIncomingEventAsync` catches all exceptions.
- Invalid JSON is persisted as `InvalidJson` and dropped.
- Equipment not found or inactive is persisted and dropped without error.
- Backend dispatch failures are caught, logged, and persisted as `ForwardFailed` with truncated error message.
- A secondary persistence failure (storing `ForwardFailed` status) is logged but does not propagate.

## Logging Guidance
Log:
- event received
- event rejected due to validation
- event persisted successfully
- event persistence failed

Do not log:
- secrets
- tokens
- very large payload blobs at high-volume log levels

## Relationship Updates
If the application uses event data to update internal diagnostic state:
- keep the logic separate from raw event persistence
- ensure event storage still succeeds even if state update fails
- consider transactional boundaries carefully

## Event Mapping
Mapping lives in `Services/AmadeusEventMappingService.cs` (interface `IAmadeusEventMappingService`).
Output type: `DTOs/BackendAmadeusEventDto.cs`.

Event-family mapping rules:
- `AccessEventArrived` → emits two events (active then inactive) for access granted/denied; denied sub-type derived from `accessDeniedCode`.
- `CommEventArrived` → communication lost/restored for controller; door disconnected/reconnected.
- `TechnicalEventArrived` → controller power failure / battery failure active or restored.
- `AlarmEventArrived` → door force-opened or held-open; end-of-alarm clears state.
- `IOEventArrived` → IO open/closed/fault based on first input or output status code.
- Any other method → `Amadeus.Generic` active event.

Numeric type codes in the mapper are based on the legacy implementation. Verify and tune values in `AmadeusEventMappingService` if your Amadeus tenant uses different enum ordinals.

## Future Extension
Potential enhancements:
- queue-based processing
- dead-letter handling
- replay tooling
- dedicated handler per event family as routing table
