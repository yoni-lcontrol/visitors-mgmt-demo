# Architecture Overview

## Summary
This system is a single `.NET 9` ASP.NET Core Web API that also runs hosted background services. It integrates with Amadeus8 using REST/OData for data synchronization and SignalR Push API for real-time events.

## Main responsibilities
- Host internal API endpoints for health, sync, and orchestration.
- Continuously listen to Amadeus8 events through SignalR.
- Import infrastructure entities from Amadeus8.
- Import access-level related entities from Amadeus8.
- Download and mirror cardholders from Amadeus8.
- Execute cardholder create/update/delete flows against Amadeus8.
- Persist synchronized entities and received events in the local database.
- Run as a Windows Service with automatic restart and reconnect behavior.

## Main domains
### Infrastructure domain
- controllers
- doors
- door IO
- extensions
- extension IO

### Access domain
- Access Groups (door access groups)
- Security Groups / MAGs
- local access-level abstraction if the application needs one unified concept

### Cardholder domain
- cardholder mirror/sync
- command flows for create/update/delete/archive
- cardholder assignment to groups
- optional card/badge sub-domain

### Event domain
- raw SignalR event payloads received via `AmadeusSignalRClient`
- parsed and normalized into `AmadeusEventContext`
- equipment resolution across Door, DoorIo, ExtensionIo, Controller
- inactive-entity filtering before backend dispatch
- event-family mapping via `IAmadeusEventMappingService` → `BackendAmadeusEventDto`
- centralized backend dispatch via `IBackendApiClient.SendAmadeusEventsAsync`
- full lifecycle status persisted in `EventLogs` table

## Recommended solution layout
- `Controllers` - thin API controllers
- `HostedServices` - long-running workers
- `Services` - business, integration, import, and command services
- `Data` - `DbContext` and persistence config
- `Entities` - EF entities
- `Models` / `DTOs` - transport and integration contracts
- `Mappings` - mapping Amadeus payloads to internal models

### Endpoint definitions
- External API endpoint paths and URL composition should be centralized in one dedicated definitions file.
- Amadeus client source of truth: `Services/AmadeusApiDefinitions.cs`.
- Backend client source of truth: `Services/BackendApiDefinitions.cs`.
- Services should reference centralized definitions instead of embedding path literals.
- Backend API contract details and maintenance rules: `docs/backend-api.md`.

### Event pipeline services
- `Services/AmadeusSignalRClient.cs` — SignalR subscription, scoped processing, application-lifetime cancellation token propagation
- `Services/EventProcessingService.cs` — orchestrates parse → resolve → persist → map → dispatch
- `Services/EquipmentResolverService.cs` — multi-strategy equipment resolution (Door, DoorIo, ExtensionIo, Controller)
- `Services/AmadeusEventMappingService.cs` — event-family-specific mapping to `BackendAmadeusEventDto`
- `Services/BackendApiClient.cs` — centralized HTTP dispatch with retry

## Important architectural rule
Do not access the Amadeus SQL database directly. The integration must use the official API surface and Push API. The vendor guide explicitly warns against direct database changes and documents Push API over SignalR plus token-based authentication.  
Source reference for the repo docs: uploaded Amadeus8 API Center Reference Guide.
