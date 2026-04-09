# Development Rules & Conventions

## General Principles

1. **Keep code explicit**  
   Prefer readable, obvious code over clever shortcuts.

2. **Fail fast**  
   Validate input early and surface errors as soon as possible.

3. **Be DRY, but practical**  
   Reuse logic where it improves maintainability. Avoid abstractions that make the code harder to follow.

4. **Follow conventions consistently**  
   Prefer predictable patterns over one-off implementations.

5. **Backend is the source of truth**  
   Frontend improves UX and usability. Backend enforces validation, authorization, and business rules.

6. **Design for extension**  
   New modules and features should follow existing patterns and fit naturally into the current architecture.

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|-----------|---------|
| Entity | `{name}.entity.ts` | `user.entity.ts` |
| DTO | `{action}-{name}.dto.ts` | `create-user.dto.ts` |
| Controller | `{name}.controller.ts` | `users.controller.ts` |
| Service | `{name}.service.ts` | `users.service.ts` |
| Module | `{name}.module.ts` | `users.module.ts` |
| Guard | `{name}.guard.ts` | `jwt-auth.guard.ts` |
| Filter | `{name}.filter.ts` | `all-exceptions.filter.ts` |
| Interceptor | `{name}.interceptor.ts` | `logging.interceptor.ts` |
| Pipe | `{name}.pipe.ts` | `parse-int-id.pipe.ts` |
| Decorator | `{name}.decorator.ts` | `current-user.decorator.ts` |
| Enum | `{name}.enum.ts` | `device-status.enum.ts` |
| Interface | `{name}.interface.ts` | `jwt-payload.interface.ts` |
| Constants | `{name}.constants.ts` | `app.constants.ts` |
| Angular Component | `{name}.component.ts` | `user-list.component.ts` |
| Angular Service | `{name}.service.ts` | `users-api.service.ts` |
| Angular Guard | `{name}.guard.ts` | `auth.guard.ts` |
| Angular Directive | `{name}.directive.ts` | `has-permission.directive.ts` |
| Angular Pipe | `{name}.pipe.ts` | `date-format.pipe.ts` |

### Classes and Interfaces

- **Entities**: `User`, `Role`, `AcController`
- **DTOs**: `CreateUserDto`, `UpdateRoleDto`
- **Services**: `UsersService`, `AuthService`
- **Controllers**: `UsersController`
- **Interfaces**: suffix with `Interface` only if it adds clarity; otherwise prefer meaningful names like `JwtPayload`

### Database

- **Tables**: PascalCase, plural: `Users`, `Roles`, `Permissions`, `AcControllers`
- **Columns**: camelCase: `firstName`, `createdAt`, `hostUserId`
- **Foreign keys**: `{relatedEntity}Id`: `roleId`, `controllerId`, `visitorId`
- **Audit columns**: use a consistent set where relevant:
  - `createdAt`
  - `updatedAt`
  - `createdBy`
  - `updatedBy`

### API

- **Route paths**: kebab-case, plural where applicable  
  Examples:
  - `/api/users`
  - `/api/roles`
  - `/api/access-control/controllers`
  - `/api/visitors`

- **Query params**: camelCase  
  Example:
  - `?sortBy=createdAt&sortOrder=DESC`

- **Request/response bodies**: camelCase matching DTO fields

---

## Code Style

### TypeScript

- Enable strict mode
- Avoid `any`; if used, document why
- Use explicit return types on public methods
- Prefer `readonly` when values should not change
- Use enums for closed sets of values
- Keep functions short and focused
- Prefer composition over large utility classes
- Do not mix unrelated responsibilities in the same file

### NestJS

- One main class per file
- Controllers handle transport concerns only
- Services contain business logic
- Repositories/data access handle persistence concerns
- Use constructor-based dependency injection
- Use DTOs for all request validation
- Use `class-validator` and global `ValidationPipe`
- **GUID/UUID validation**: Use `@Matches(GUID_REGEX)` from `common/constants/regex.constants.ts` instead of `@IsUUID()`. MSSQL generates GUIDs with non-standard version nibbles (e.g., `F111`) that `@IsUUID()` rejects. For array fields, use `@Matches(GUID_REGEX, { each: true })`.
- Feature modules must stay isolated by responsibility
- Shared/common code belongs in `common` or clearly defined shared modules
- Avoid circular dependencies; refactor shared logic instead

### NestJS Error Handling

- Never throw generic `Error` in services. Use proper NestJS HTTP exceptions:
  - `NotFoundException` — entity not found
  - `BadRequestException` — invalid input or business rule violation
  - `ForbiddenException` — access denied
  - `ConflictException` — duplicate or conflicting state
  - `ServiceUnavailableException` — external service or agent unavailable

### Angular

- Use standalone components unless there is a strong reason not to
- Use `ChangeDetectionStrategy.OnPush` where possible
- Use reactive forms, not template-driven forms, for business features
- Use lazy-loaded feature routes
- Use smart/container and presentational component separation where it adds clarity
- Components must not call HTTP directly; use feature API/services
- Keep permissions and auth checks centralized
- Prefer strongly typed models for API responses
- Use `takeUntilDestroyed()` / `DestroyRef` for subscription cleanup when needed
- Use `ConfirmService` for all confirmation dialogs (never use `window.confirm()`)
- Feature API services encapsulate all HTTP calls for a feature (e.g., `UsersApiService`, `RolesApiService`)

---

## Architecture Rules

1. Keep modules feature-based, not mixed by technical layer only.
2. Each feature should have a clear boundary and responsibility.
3. Avoid putting business logic in controllers, guards, or Angular components.
4. Shared logic must be reusable and placed in a predictable shared location.
5. External integrations must be isolated behind services/adapters.
6. Database schema changes must be handled via migrations.
7. Security-related logic must always be enforced on the backend.

---

## Pagination Standard

All paginated `findAll` methods must use the shared `paginateQuery` helper from `src/common/utils/paginate.util.ts`. Never duplicate the skip/take/getCount/envelope logic in individual services.

### Usage

```ts
import { paginateQuery } from '../common/utils/paginate.util';

async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Entity>> {
    return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
}
```

If post-processing is needed (e.g., stripping sensitive fields), call `paginateQuery` first and transform `result.items` afterward.

---

## Vehicle Type Presentation

All vehicle-type translation maps and dropdown option builders must use the shared utilities from `@core/utils/vehicle-type.util.ts`. Never duplicate the `VehicleType → translation key` mapping in components.

| Utility | Purpose |
|---------|---------|
| `VEHICLE_TYPE_TRANSLATION_KEYS` | Map of VehicleType enum → i18n key |
| `buildVehicleTypeOptions(translate)` | Builds dropdown options array with translated labels |
| `getVehicleTypeLabel(type, translate)` | Returns translated label for a vehicle type value |

---

## Confirmation Dialogs

All user confirmation prompts must use the shared `ConfirmService` from `@core/services/confirm.service.ts`. Never use `window.confirm()`.

### Usage

```typescript
private confirmService = inject(ConfirmService);

async onDelete(item: Item): Promise<void> {
    if (await this.confirmService.confirm('ITEMS.DELETE_CONFIRM', { name: item.name })) {
        // proceed with delete
    }
}
```

The service uses PrimeNG `ConfirmationService` with `ngx-translate` for i18n. All confirmation message keys must exist in both `en.json` and `he.json`.

---

## Subscription Cleanup

Components that subscribe to long-lived observables (e.g., `onLangChange`, WebSocket events) must use `takeUntilDestroyed()` with `DestroyRef`:

```typescript
private destroyRef = inject(DestroyRef);

ngOnInit(): void {
    this.translateService.onLangChange
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => { /* react to lang change */ });
}
```

Never store manual `Subscription` objects for cleanup when `takeUntilDestroyed` is available.

---

## Feature API Services

Each frontend feature must encapsulate HTTP calls in a dedicated API service. Components must not call `ApiService` directly.

| Feature | Service | Location |
|---------|---------|----------|
| Users | `UsersApiService` | `features/users/services/users-api.service.ts` |
| Roles | `RolesApiService` | `features/roles/services/roles-api.service.ts` |
| Access Control | `AccessControlApiService` | `features/access-control/services/access-control-api.service.ts` |
| Visits | `VisitsApiService` | `features/visits/services/visits-api.service.ts` |
| Workstations | `WorkstationsApiService` | `features/workstations/workstations-api.service.ts` |
| Audit | `AuditApiService` | `features/audit/services/audit-api.service.ts` |
| Buildings | `BuildingsApiService` | `features/settings/services/buildings-api.service.ts` |
| Card Templates | `CardTemplateApiService` | `features/settings/services/card-template-api.service.ts` |

---

## Excel Export Standard

All modules that export data to Excel must follow this standard pattern:

### Backend

1. **Formatting** — Use `toExcelBuffer(rows, sheetName)` from `src/common/utils/excel.util.ts`. Never create ExcelJS workbooks directly in services.
2. **Response** — Use `sendExcelResponse(res, buffer, filename)` from the same utility. Never set Content-Type/Content-Disposition headers manually in controllers.
3. **Service method** — Each service implements `exportToExcel(query)` that:
   - Reuses the same query builder as `findAll` (extract to a private `buildQuery`/`buildFindAllQuery` method)
   - Fetches all matching records (no pagination)
   - Maps entities to flat `Record<string, unknown>` rows with human-readable column headers
   - Passes rows to `toExcelBuffer(rows, 'SheetName')`
4. **Controller endpoint** — `GET export` with appropriate `@RequirePermissions`, calls service and passes result to `sendExcelResponse`.

### Frontend

1. **Download utility** — Use `downloadBlob(blob, filename)` from `@core/utils/download.util`. Never create blob URLs manually.
2. **Export method** — Each component implements `exportData()` that builds query params from `lastLazyEvent` (filters, sort, search) and calls `api.download()`.
3. **Naming** — Files are named `{entity}.xlsx` (e.g., `users.xlsx`, `roles.xlsx`, `audit-logs.xlsx`).

### Shared utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `toExcelBuffer` | `backend/src/common/utils/excel.util.ts` | Converts row data to styled Excel buffer |
| `sendExcelResponse` | `backend/src/common/utils/excel.util.ts` | Sets headers and sends Excel buffer to client |
| `downloadBlob` | `frontend/src/app/core/utils/download.util.ts` | Triggers browser file download from blob |
| `paginateQuery` | `backend/src/common/utils/paginate.util.ts` | Standard paginated query execution envelope |
| `getDayBoundsUtc` | `backend/src/common/utils/date.util.ts` | Timezone-aware day boundary calculation (respects `BUSINESS_TIMEZONE` env var, defaults to `Asia/Jerusalem`) |
| `buildVehicleTypeOptions` | `frontend/src/app/core/utils/vehicle-type.util.ts` | Vehicle type dropdown options with translation |
| `getVehicleTypeLabel` | `frontend/src/app/core/utils/vehicle-type.util.ts` | Translated label for a vehicle type value |
| `DateFormatPipe` | `frontend/src/app/shared/pipes/date-format.pipe.ts` | Timezone-aware date/time formatting (uses `Asia/Jerusalem` via `Intl.DateTimeFormat`) |

---

## Date/Time Display

All date/time values must be displayed in the **business timezone** (`Asia/Jerusalem`). Never use browser local time (`d.getHours()`, `toLocaleTimeString()` without explicit timezone).

### Frontend

- Use `DateFormatPipe` for all date display in templates: `{{ value | dateFormat }}`, `{{ value | dateFormat:'date' }}`, `{{ value | dateFormat:'time' }}`
- The pipe uses `Intl.DateTimeFormat` with `timeZone: 'Asia/Jerusalem'`
- For programmatic time formatting, use a static `Intl.DateTimeFormat` instance with the same timezone
- Do not use Angular's `DatePipe` with an empty timezone string (`''`) for visit-related times

### Backend

- All "today" filtering uses `getDayBoundsUtc()` which respects `BUSINESS_TIMEZONE`
- Database stores UTC (`datetime2`), display conversion is frontend responsibility

---

## Batch Database Queries

When checking or looking up multiple records, use batch methods to avoid N+1 query patterns:

- `BlacklistService.checkBlacklistStatusBatch(ids[])` — single query for multiple person IDs
- `BlacklistService.checkVehicleBlacklistStatusBatch(carNumbers[])` — single query for multiple car numbers
- Never loop over individual `checkBlacklistStatus()` calls when processing multiple visitors

---

## Authentication and Authorization Rules

1. JWT authentication must be enforced for protected endpoints.
2. Permission checks must be enforced on the backend, even if hidden in the frontend.
3. Frontend permission handling is for UX only, never for security.
4. Role and permission names must follow a predictable naming convention:
   - `users.view`
   - `users.create`
   - `users.edit`
   - `users.delete`
   - `visitors.invite`
   - `accessControl.import`
   - `settings.manage`
5. Any new protected feature must define its required permissions.
6. Permission constants/enums must be updated whenever secured functionality is added.

---

## API Rules

1. Use DTOs for every input model.
2. Validate every request.
3. Keep API responses consistent in shape and naming.
4. Use appropriate HTTP status codes.
5. Do not expose internal errors or stack traces to clients.
6. Document every endpoint with Swagger decorators.
7. Keep controllers thin and move business rules into services.
8. Breaking API contract changes must be documented.

---

## API Change Validation Rule

Any backend API change must include relevant automated test coverage.

### Required

- If an endpoint is added, create tests for it.
- If an endpoint is changed, update and run its related tests.
- If request or response contracts change, update tests accordingly.
- API work is not complete until the relevant tests pass.

### Minimum Expectations

Each API change should validate:

- success scenarios
- validation failures
- authentication and authorization behavior
- main failure scenarios
- response body shape
- HTTP status codes

### Backend Testing Expectations for API Changes

Include the appropriate mix of:

- unit tests for service logic
- controller/integration tests where relevant
- e2e tests for important flows

### Definition of Done for API Changes

An API-related task is complete only when:

- implementation is finished
- relevant tests were added or updated
- relevant tests pass
- Swagger/API documentation is updated if needed

---

## Testing Strategy

### Backend

| Type | Location | Naming | Tools |
|------|----------|--------|-------|
| Unit tests | same folder as source | `*.spec.ts` | Jest |
| Integration / controller tests | same module or dedicated test folder | `*.spec.ts` | Jest |
| E2E tests | `test/` | `*.e2e-spec.ts` | Jest + Supertest |

### Frontend

| Type | Location | Naming | Tools |
|------|----------|--------|-------|
| Unit tests | same folder as source | `*.spec.ts` | Jest or Karma/Jasmine |
| Component/integration tests | same feature area | `*.spec.ts` | preferred frontend test runner |
| E2E tests | `e2e/` | `*.e2e-spec.ts` | Playwright preferred |

### What to Test

**Always test:**
- service business logic
- guards
- interceptors
- pipes
- auth and permission behavior
- complex Angular component logic

**Usually test:**
- controller behavior
- form flows
- state transitions
- websocket handlers

**Test lightly:**
- trivial pass-through CRUD
- very simple presentational components

---

## WebSocket Rules

1. WebSocket connections must be authenticated.
2. Event names must follow a consistent naming convention.
3. Payloads should be typed and documented.
4. Gateway logic should stay thin; delegate business logic to services.
5. Important realtime flows should be covered by tests where practical.
6. Frontend websocket subscriptions must be centralized in dedicated services.

---

## Error Handling Rules

1. Never swallow errors silently.
2. Throw specific exceptions for known business cases.
3. Validation errors should be handled centrally.
4. Unhandled errors must pass through a global exception filter.
5. Return a consistent error response format.
6. Log errors with context such as:
   - user ID
   - request path
   - correlation ID
   - module name
7. Sanitize sensitive data from logs and responses.

---

## Logging Rules

1. Use centralized logging patterns.
2. Log important state transitions and failures.
3. Do not log secrets, passwords, raw tokens, or sensitive personal data.
4. Use structured and searchable log messages where possible.
5. Include enough context to troubleshoot without reading the code.

---

## Git Conventions

### Branch Naming

```text
feature/{module}-{description}    → feature/auth-login-flow
bugfix/{module}-{description}     → bugfix/users-duplicate-email
hotfix/{description}              → hotfix/jwt-expiry-crash
chore/{description}               → chore/upgrade-nestjs-10