# Configuration

## Goal
Centralize application settings and keep environment-specific values out of code.

## Recommended Sources
- `appsettings.json`
- `appsettings.Development.json`
- environment variables
- secret storage for sensitive values

## Core Configuration Sections

### Amadeus
Suggested keys:
- `BaseUrl`
- `TokenEndpoint`
- `RenewTokenEndpoint`
- `SignalRHubUrl`
- `ApiKey`
- `Username`
- `Password`
- `FullSyncIntervalMinutes`
- `StartupSyncEnabled`
- `ListenerReconnectDelaySeconds`
- `InfrastructureImportBatchSize`
- `AccessGroupsImportBatchSize`

Batch-size guidance:
- `InfrastructureImportBatchSize` controls paged retrieval for controllers, readers/doors, inputs, outputs, door IOs, extensions, and extension IOs.
- `AccessGroupsImportBatchSize` controls paged retrieval for Access Groups and Security Groups.
- Use smaller values in constrained environments and larger values for higher throughput.

### ConnectionStrings
- `DefaultConnection`

### Logging
- provider configuration
- log level overrides
- file sink configuration if used

### Backend
- Backend API route definitions are centralized in `Services/BackendApiDefinitions.cs`.
- Backend endpoint maintenance guide: `docs/backend-api.md`.
- Do not hardcode backend route/path literals in service classes.

Suggested keys:
- `BaseUrl`

## Rules
- bind to strongly typed options classes
- validate required settings on startup
- never hardcode credentials
- keep production overrides outside source control when appropriate

## Backend Request Convention
- Keep endpoint path constants only in `Services/BackendApiDefinitions.cs`.
- Build full backend URLs with `BackendApiDefinitions.BuildUrl(baseUrl, relativePath, endpointName)`.
- If/when a backend client service is added, it must consume the centralized definitions file.

Current backend access layer:
- `Services/BackendApiClient.cs`
- `Services/BackendEquipmentSnapshotProvider.cs`

The central database is not accessed directly by this service. Comparison data must come through backend APIs.

## Backend request definitions
- All external API route/path definitions are centralized in `Services/BackendApiDefinitions.cs`.
- Service classes should not hardcode endpoint literals for token, SignalR hub, or OData resources.
- `BaseUrl` remains in configuration (`Amadeus:BaseUrl`) and is combined with centralized endpoint definitions.
- To add a new backend endpoint:
1. Add the route/path in `Services/BackendApiDefinitions.cs`.
2. Consume it from the calling service.
3. Keep URL building through the shared helper methods in the definitions file.
