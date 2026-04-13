# Amadeus8 Integration

## Integration style
Use:
- REST/OData for reads and CRUD operations
- `/api/Token/` and `/api/Token/RenewToken` for authentication and renewal
- SignalR Push API for real-time events
- OData discovery via `/odata/` and `/odata/$metadata` to validate entity names and properties

## Vendor-documented prerequisites
Before Push API can work on the server:
- `Allow API` must be enabled for the user
- the API key must be configured correctly
- `Pass events to AP/API` must be enabled in communication settings

## Main Amadeus areas relevant to this project
### Infrastructure
- Inputs
- Controllers
- Outputs / Relays
- Readers

### Access and cardholders
- Security Groups (MAGs)
- Access Groups
- Cardholders
- Cardholder updates
- Cardholder delete/archive
- Cards / badges
- Cardholder personal/customized fields where needed

## Recommended internal services
- `AmadeusAuthService`
- `AmadeusApiClient`
- `AmadeusSignalRClient`
- `InfrastructureImportService`
- `AccessGroupImportService`
- `AccessLevelImportService`
- `CardholderSyncService`
- `CardholderCommandService`

## Authentication flow
1. Get token from `/api/Token/`.
2. Store token in memory only.
3. Renew through `/api/Token/RenewToken` before expiry or on `401`.
4. Use bearer token for OData/HTTP requests and Push API negotiation if required by the client setup.

## Push API flow
1. Start app.
2. Authenticate.
3. Build SignalR connection.
4. Subscribe to events.
5. Store raw payloads and process normalized event records.
6. On disconnect, log and reconnect.

## Access levels in this project
This application should support importing two Amadeus concepts and deciding whether to expose them internally as one unified access-level view:
- **Access Groups**: mainly door access groups
- **Security Groups (MAGs)**: multi-access/security groups

The internal model may keep them as separate tables or unify them under a common read model, but code must preserve their original Amadeus type.

Current implementation imports:
- Access Groups into `AccessGroups`
- Security Groups into `SecurityGroups`
- unified normalized records into `AccessLevels` with a `SourceType` discriminator

Import result summaries include:
- total received
- created
- updated
- unchanged
- skipped invalid
- failed

## Cardholder scope in this project
The application should support:
- full cardholder download/sync
- get cardholder by UID
- get paged cardholders
- create cardholder
- update cardholder
- remove/delete or archive cardholder
- assign/update security groups and access groups
- optional badge/card operations in a separate service

## Discovery recommendation
Always validate live entity names and available fields against `/odata/` and `/odata/$metadata` before hard-coding mappings.
