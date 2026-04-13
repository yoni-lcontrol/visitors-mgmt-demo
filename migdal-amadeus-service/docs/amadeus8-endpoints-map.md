# Amadeus8 Endpoints Map

> Important: verify exact live behavior against `/odata/` and `/odata/$metadata` in the target environment before locking implementation details.

## Discovery and auth
- `GET /odata/` - list entity sets
- `GET /odata/$metadata` - inspect entity types, keys, and properties
- `POST /api/Token/` - generate token
- `POST /api/Token/RenewToken` - renew token

## Infrastructure
- `GET /odata/API_Controllers` - controllers
- `GET /odata/API_Inputs` - inputs / possible extension IO mapping inputs
- `GET /odata/API_Outputs` - outputs / relay / door IO candidates
- `GET /odata/API_Readers` - readers / door mapping candidates

Paged retrieval examples:
- `GET /odata/API_Controllers?$skip=...&$top=...&$count=true`
- `GET /odata/API_Readers?$skip=...&$top=...&$count=true`
- `GET /odata/API_Inputs?$skip=...&$top=...&$count=true`
- `GET /odata/API_Outputs?$skip=...&$top=...&$count=true`

## Access model
### Security Groups / MAGs
- `GET /odata/API_SecurityGroups` - list security groups
- `GET /odata/API_SecurityGroups(<uid>)` - get security group by UID
- `GET /odata/api_SecurityGroups?$filter=apiKey eq '<ApiKey>'` - get by API key
- `GET /odata/API_SecurityGroups?$skip=...&$top=...&$count=true` - paged sync

### Access Groups
- `GET /odata/API_AccessGroups` - list access groups
- `GET /odata/API_AccessGroups(<uid>)` - get access group by UID
- `GET /odata/api_AccessGroups?$filter=apiKey eq '<ApiKey>'` - get by API key
- `GET /odata/API_AccessGroups?$skip=...&$top=...&$count=true` - paged sync

## Cardholders
### Read
- `GET /odata/API_Cardholders` - list cardholders / paged read
- `GET /odata/API_Cardholders(<uid>)` or expanded endpoint - get by UID depending on chosen projection
- `GET /odata/API_Cardholders?$skip=...&$top=...&$count=true` - paged sync
- `GET /odata/API_Cardholders/GetCardholdersCount` or function import exposed in metadata - count support if used

### Create
- `POST /odata/API_Cardholders` - create minimal/full cardholder depending on payload
- supported vendor examples include:
  - create minimal cardholder
  - create cardholder with security group API key
  - create cardholder with personal access groups UIDs/API keys
  - create cardholder with cards/badges and personal details

### Update
- `PATCH /odata/API_Cardholders(<uid>)` - update cardholder (editable fields or ignore non-editable depending on endpoint contract)
- `POST /odata/...` full update example exists for full cardholder update flows with personal details/cards in vendor guide
- `PATCH /odata/API_Cardholders(<uid>)` with group-related fields or dedicated action for updating access groups according to guide examples

### Delete / archive
- `DELETE` cardholder remove endpoint - supported by vendor guide
- `DELETE` archive cardholder endpoint - supported by vendor guide

## Group assignment helpers
- create cardholder with security group API key
- create cardholder with access groups by API keys or UIDs
- patch/update cardholder access groups by API key
- get AGs of cardholder UID

## Cards / badges
- `GET /odata/API_Cards`
- `POST /odata/API_Cards`
- `PATCH /odata/API_Cards(<uid>)`
- `DELETE /odata/API_Cards(<uid>)`

## Internal mapping note
The app exposes a local unified `AccessLevel` read model, and persistence retains whether the source is:
- `AccessGroup`
- `SecurityGroup`

Normalized access-level import:
- Reads from both `API_AccessGroups` and `API_SecurityGroups`
- Upserts to local `AccessLevels` table using composite key (`SourceType`, `AmadeusUid`)
- Tracks and logs summary counts: total received, created, updated, unchanged, skipped, failed

## Implementation note
- Code-level route definitions used by services are centralized in `Services/BackendApiDefinitions.cs`.
- Keep this map and the centralized definitions aligned when adding or changing endpoints.
