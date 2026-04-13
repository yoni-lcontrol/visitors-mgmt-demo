# API Guidelines

## Controller responsibilities
Controllers must be thin. They should validate input, call services, and return clear responses.

## Suggested endpoints
### Health
- `GET /api/health`
- `GET /api/health/amadeus`
- `GET /api/health/listener`

### Sync
- `POST /api/sync/full`
- `POST /api/sync/infrastructure`
- `POST /api/sync/access-groups`
- `POST /api/sync/security-groups`
- `POST /api/sync/access-levels`
- `POST /api/sync/cardholders`

### Amadeus import endpoints
- `POST /api/amadeus/import/access`

Import type source:
- import type is read from configuration (`AmadeusImport:ImportAccessLevels`)
- request body does not include import type
- allowed values: `true` (AccessLevels), `false` (AccessGroups)

Import response summary should include:
- `importType`
- `success`
- `message`
- `totalReceived`
- `created`
- `updated`
- `skipped`
- `failed`

### Cardholders
- `GET /api/cardholders`
- `GET /api/cardholders/{uid}`
- `POST /api/cardholders`
- `PATCH /api/cardholders/{uid}`
- `DELETE /api/cardholders/{uid}`
- `POST /api/cardholders/{uid}/archive`
- `POST /api/cardholders/{uid}/groups`

### Access levels
- `GET /api/access-groups`
- `GET /api/security-groups`
- `GET /api/access-levels` (optional unified read model)

## Response guidance
- Use DTOs.
- Return meaningful validation errors.
- Do not expose secrets or internal exception details.
