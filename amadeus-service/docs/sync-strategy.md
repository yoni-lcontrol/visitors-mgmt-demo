# Sync Strategy

## Objectives
The synchronization logic must:
- import infrastructure from Amadeus8
- keep the local database aligned with source data
- compare imported equipment against central-system data fetched via backend APIs
- recover from temporary connectivity issues
- avoid duplication
- support manual and automatic sync

## Sync Types

### Startup Sync
Runs shortly after application startup.
Purpose:
- seed local data
- recover from downtime
- validate connectivity

### Periodic Sync
Runs on a configured interval.
Purpose:
- catch missed changes
- refresh infrastructure state
- compensate for transient Push API interruptions

### Manual Sync
Triggered through internal API endpoints.
Purpose:
- operator support
- testing
- emergency reconciliation

## Sync Rules
- Use stable external IDs for upsert.
- Keep sync idempotent.
- Do not create duplicates for already imported entities.
- Prefer update-in-place for changed external records.
- Log counts for created, updated, unchanged, and failed records.
- Never compare against central DB using direct DB access from this service.
- Central-system comparison data must be fetched through backend APIs only.

## Batch/Paged Import Strategy
- Infrastructure and access-model imports run in pages using Amadeus OData paging parameters (`$skip`, `$top`, `$count=true`).
- Batch size is configurable through `Amadeus:InfrastructureImportBatchSize` and `Amadeus:AccessGroupsImportBatchSize`.
- Each batch logs start/completion, batch size, cumulative processed count, and total count when available.
- `SaveChangesAsync` is executed per batch to keep memory usage controlled and to preserve partial progress safely.
- If one item fails, import continues with other items in the batch and increments failure counters.
- If backend startup snapshot is unavailable, equipment import stops early with a clear error and does not continue.

## Overlap Prevention
A sync cycle must not overlap with another cycle of the same type.
Recommended options:
- in-memory semaphore for single-instance app
- persistent distributed lock only if multi-instance deployment is introduced later

## Deletion Strategy
Default guidance:
- do not hard-delete local records just because one sync response did not include them
- mark as inactive or missing only if business rules confirm deletion behavior
- document final removal behavior explicitly before implementing it

## Mapping Strategy
The local domain model does not need to match Amadeus entities 1:1.
The sync layer is responsible for:
- reading external entities
- translating them into internal entities
- preserving stable relationships

## Central Comparison Strategy
- On startup, this service attempts to load central equipment snapshots (controllers, doors, door IOs, extensions, extension IOs) through backend APIs.
- During equipment imports, each imported equipment record is compared against backend-provided central snapshot data loaded at startup.
- Import flows do not fetch central data from backend on-demand.
- Incoming Amadeus data is still persisted locally in this service DB for local state, auditability, and retry processing.

## Recommended Sync Order
A common order is:
1. sites (if used)
2. controllers
3. extensions / modules (derived from paged inputs/outputs)
4. readers
5. door IO mapping (from paged inputs/outputs where `ModuleId` is empty)
6. extension IO mapping (from paged inputs/outputs where `ModuleId` is set)
7. Security Groups (MAGs)
8. Access Groups
9. normalized Access Levels (union of Security Groups + Access Groups)
10. cardholders (paged)

Adjust this order once the final entity relationships are verified.

## Failure Handling
- If one entity type fails, log it clearly.
- Decide whether the whole sync should stop or continue per entity type.
- Favor partial progress with clear error reporting unless consistency requires fail-fast behavior.

## Observability
Track and expose:
- last sync start time
- last sync end time
- last successful sync time
- current sync state
- last sync error summary
