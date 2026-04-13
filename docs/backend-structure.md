## Device Agent Modules

The printer/scanner agent architecture adds five backend modules:

```text
backend/src/
├── workstations/                    # Admin-managed workstation CRUD, user/role binding, enrollment
│   ├── entities/
│   │   ├── workstation.entity.ts              # Workstations table (code, displayName, machineId)
│   │   ├── user-workstation-session.entity.ts # UserWorkstationSessions table
│   │   ├── workstation-user.entity.ts         # WorkstationUsers M:M junction
│   │   ├── workstation-role.entity.ts         # WorkstationRoles M:M junction
│   │   └── workstation-enrollment-token.entity.ts # Enrollment tokens for agent onboarding
│   ├── dto/
│   │   ├── create-workstation.dto.ts
│   │   ├── update-workstation.dto.ts
│   │   ├── assign-workstation-users.dto.ts
│   │   ├── assign-workstation-roles.dto.ts
│   │   ├── create-enrollment-token.dto.ts
│   │   └── bind-workstation.dto.ts
│   ├── services/
│   │   ├── workstation-session.service.ts     # Bind/unbind user ↔ workstation (validates access)
│   │   └── workstations.service.ts            # Full CRUD, user/role assignment, enrollment tokens
│   ├── workstations.controller.ts             # CRUD + assignment + enrollment + bind endpoints
│   └── workstations.module.ts
│
├── agents/                          # Device agent lifecycle
│   ├── entities/
│   │   └── device-agent.entity.ts             # DeviceAgents table (includes live connection state)
│   ├── enums/
│   ├── services/
│   │   ├── agent-hmac-auth.service.ts         # HMAC-SHA256 validation for agents
│   │   └── agent-registry.service.ts          # Agent connect/disconnect/heartbeat
│   └── agents.module.ts
│
├── device-commands/                 # Command routing (user → agent)
│   ├── entities/
│   │   └── device-command-log.entity.ts       # DeviceCommandLogs table
│   ├── enums/
│   │   └── device-command-status.enum.ts      # Pending → Completed/Failed/TimedOut
│   ├── services/
│   │   └── device-command-routing.service.ts  # Routes commands via workstation binding
│   │                                          # Tracks providerType + commandType per pending command
│   │                                          # for provider-aware result routing (scanner vs printer)
│   └── device-commands.module.ts
│
├── printing/                        # Print card orchestration
│   ├── services/
│   │   └── printing.service.ts                # Validates & routes print + test-print requests via DeviceCommandRoutingService
│   └── printing.module.ts                     # Depends on DeviceCommandsModule
│
├── scanning/                        # Scanner action orchestration
│   ├── services/
│   │   └── scanning.service.ts                # Validates & routes scan requests
│   └── scanning.module.ts
│
├── websocket/                       # Dual-gateway WebSocket
│   ├── gateways/
│   │   ├── users.gateway.ts                   # /ws/users (JWT auth)
│   │   └── agents.gateway.ts                  # /ws/agents (HMAC auth, provider-aware result routing)
│   ├── interfaces/
│   │   └── ws-payloads.interface.ts            # Typed WS payload interfaces
│   ├── enums/
│   │   └── ws-events.enum.ts
│   ├── websocket.gateway.ts                   # Legacy gateway (delegates to UsersGateway)
│   └── websocket.module.ts
│
├── buildings/                       # Building management CRUD
│   ├── entities/
│   │   └── building.entity.ts                 # Buildings table (name, address, active)
│   ├── dto/
│   │   ├── create-building.dto.ts
│   │   ├── update-building.dto.ts
│   │   └── building-query.dto.ts
│   ├── buildings.service.ts                   # Full CRUD with soft-delete, FK nullification on Visits
│   ├── buildings.controller.ts                # CRUD endpoints with permission guards
│   └── buildings.module.ts
│
├── scheduled-tasks/                 # Centralized cron jobs
│   ├── ad-sync.task.ts                        # Daily AD user sync (01:00 AM)
│   ├── retention-cleanup.task.ts              # Daily data retention cleanup (midnight)
│   ├── visitor-auto-checkout.task.ts          # Daily auto-checkout expired visitors (midnight)
│   ├── token-cleanup.task.ts                  # Daily purge expired/revoked refresh tokens (01:00 AM)
│   └── scheduled-tasks.module.ts
│
└── health/                          # Application health checks
    ├── health.controller.ts                   # GET /health (public, DB ping)
    └── health.module.ts
```

## Sites Module (Multi-Site)

The sites module manages multi-site infrastructure, including site CRUD and user-to-site assignment:

```text
backend/src/sites/
├── entities/
│   ├── site.entity.ts                         # Sites table (name, code, address, timezone, contact)
│   └── user-site.entity.ts                    # UserSites junction (userId, siteId, isPrimary)
├── dto/
│   ├── create-site.dto.ts                     # Name, code, address, timezone, contactPhone, contactEmail
│   ├── update-site.dto.ts                     # Partial of create + isActive toggle
│   ├── site-query.dto.ts                      # Extends PaginationQueryDto
│   └── assign-user-sites.dto.ts               # Array of siteIds to assign to a user
├── sites.service.ts                           # CRUD, user-site assignment, active site queries
├── sites.service.spec.ts                      # Unit tests for service
├── sites.controller.ts                        # REST endpoints with permission guards
├── sites.controller.spec.ts                   # Unit tests for controller
└── sites.module.ts                            # Exports SitesService for use by auth module
```

### Multi-Site Filtering

All major list endpoints accept an optional `siteId` query parameter to filter results by site:

| Module | Service Method | Filtered Entity |
|--------|---------------|-----------------|
| Visits | `buildVisitsQuery()` | Visits |
| Audit | `buildFindAllQuery()` | AuditLogs |
| Blacklist | `buildQuery()` | BlacklistEntries |
| Access Control | `buildFindAllQuery()` | AcControllers |
| Workstations | `findAllWithDeviceStatus()` | Workstations |
| Buildings | (via frontend context) | Buildings |

### User-Site Assignment

- Users are assigned to sites via `POST /sites/assign-users/:userId` with `{ siteIds: [...] }`
- First site in the array becomes the primary site (`isPrimary: true`)
- Assignment replaces all existing assignments (delete + re-create)
- JWT token carries `siteIds[]` and `activeSiteId` for authorization
- Frontend `SiteContextService` manages the active site and passes siteId in API calls

### API Endpoints

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/sites` | `sites.read` | List all sites (paginated) |
| GET | `/sites/active` | (authenticated) | List active sites (for dropdowns) |
| GET | `/sites/:id` | `sites.read` | Get site by ID |
| POST | `/sites` | `sites.create` | Create a site |
| PATCH | `/sites/:id` | `sites.update` | Update a site |
| POST | `/sites/assign-users/:userId` | `sites.assign-users` | Assign user to sites |
| GET | `/sites/users/:userId/sites` | `sites.read` | Get sites assigned to a user |

## Amadeus Module (M2M API)

The Amadeus module provides dedicated M2M endpoints for the Amadeus access-control bridge service:

```text
backend/src/amadeus/
├── amadeus.module.ts                          # Module definition
├── amadeus.controller.ts                      # Equipment + sync controllers
├── amadeus.service.ts                         # Equipment queries + sync logic
├── amadeus.controller.spec.ts                 # Controller tests
├── amadeus.service.spec.ts                    # Service tests
└── dto/
    ├── amadeus-equipment-response.dto.ts      # Response DTOs for equipment
    └── sync-result-response.dto.ts            # Sync result response
```

### Amadeus Equipment Endpoints

All endpoints use HMAC authentication (`@Public()` + `IntegrationHmacGuard`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/controllers` | List all controllers (flat) |
| GET | `/doors` | List all doors (flat) |
| GET | `/door-ios` | List all door IOs (flat) |
| GET | `/extensions` | List all extensions (flat) |
| GET | `/extension-ios` | List all extension IOs (flat) |
| POST | `/sync/full` | Trigger full sync acknowledgement |

### Amadeus Integration Events

Event ingestion follows the integrations platform pattern:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/integrations/amadeus/events` | Receive batch of Amadeus events |
| POST | `/integrations/amadeus/events/single` | Receive single Amadeus event |

## Testing Structure

Backend tests follow three layers:

```text
backend/
├── src/
│   ├── auth/
│   │   ├── auth.service.spec.ts
│   │   ├── entra-id.service.spec.ts
│   │   └── ...
│   ├── agents/
│   │   └── services/
│   │       ├── agent-hmac-auth.service.spec.ts
│   │       └── agent-registry.service.spec.ts
│   ├── workstations/
│   │   ├── workstations.controller.spec.ts
│   │   └── services/
│   │       ├── workstation-session.service.spec.ts
│   │       └── workstations.service.spec.ts
│   ├── device-commands/
│   │   └── services/
│   │       └── device-command-routing.service.spec.ts
│   ├── printing/
│   │   └── services/
│   │       └── printing.service.spec.ts
│   ├── scanning/
│   │   └── services/
│   │       └── scanning.service.spec.ts
│   ├── scheduled-tasks/
│   │   ├── ad-sync.task.spec.ts
│   │   ├── retention-cleanup.task.spec.ts
│   │   ├── visitor-auto-checkout.task.spec.ts
│   │   └── token-cleanup.task.spec.ts
│   ├── buildings/
│   │   └── buildings.service.spec.ts
│   ├── sites/
│   │   ├── sites.service.spec.ts
│   │   └── sites.controller.spec.ts
│   ├── health/
│   │   └── health.controller.spec.ts
│   ├── users/
│   │   ├── users.service.spec.ts
│   │   ├── users.controller.spec.ts
│   │   └── ...
│   └── ...
├── test/
│   ├── auth.e2e-spec.ts
│   ├── users.e2e-spec.ts
│   ├── visitors.e2e-spec.ts
│   ├── access-control.e2e-spec.ts
│   ├── setup/
│   │   ├── test-app.factory.ts
│   │   ├── test-db.helper.ts
│   │   ├── auth.helper.ts
│   │   └── seed.helper.ts
│   └── fixtures/
│       ├── users.fixture.ts
│       ├── roles.fixture.ts
│       ├── visitors.fixture.ts
│       └── access-control.fixture.ts

## Visitors Module

The visitors module is split into focused services for maintainability:

```text
backend/src/visitors/
├── visits.service.ts               # Visit lifecycle CRUD, query, export, check-in code fire-and-forget
├── visit-participant.service.ts    # Visitor/escort CRUD, batch blacklist validation, check-in code fire-and-forget
├── visit-status.service.ts         # Access events, status management, on-site (batch blacklist), auto-checkout, history
├── visit.utils.ts                  # Shared helpers: resolveVisitRequester(), buildSmsData()
├── visits.controller.ts            # Thin controller — routes to services, no WS/notification logic
├── visit-visitors.controller.ts    # Routes visitor endpoints to VisitStatusService
├── visitor-access-log.controller.ts # Routes access log endpoints to VisitStatusService
├── blacklist.module.ts             # Standalone module: BlacklistService (no controllers)
├── blacklist.service.ts            # Blacklist CRUD, batch lookups (checkBlacklistStatusBatch)
├── blacklist.controller.ts         # Blacklist REST endpoints (registered in VisitorsModule)
├── parking-request.service.ts      # Parking request CRUD, auto-approve logic, pending count, decision changes (approved↔denied), audit logging
├── parking-request.controller.ts   # Parking approval REST endpoints (registered in VisitorsModule)
├── visitors.module.ts              # Imports BlacklistModule; registers BlacklistController, ParkingRequestController before VisitorsController
├── visits.service.spec.ts          # Tests for visit lifecycle
├── visit-participant.service.spec.ts # Tests for participant CRUD + validation
├── visit-status.service.spec.ts    # Tests for status/history/auto-checkout
└── blacklist.service.spec.ts       # Tests for blacklist CRUD + batch lookups
└── blacklist.controller.spec.ts    # Tests for blacklist controller delegation
└── parking-request.service.spec.ts # Tests for parking request service
└── parking-request.controller.spec.ts # Tests for parking request controller
```

### BlacklistModule

`BlacklistModule` is extracted as a standalone module so it can be imported by any module without depending on the full visitors module:

- **Provides**: `BlacklistService` (including `checkBlacklistStatusBatch`, `checkVehicleBlacklistStatusBatch`)
- **Imports**: `TypeOrmModule.forFeature([BlacklistEntry, User])`, `WebsocketModule`
- **Controllers**: Registered in `VisitorsModule` (before `VisitorsController`) to avoid wildcard `:id` route conflicts. `BlacklistModule` itself has no controllers.
- **Imported by**: `VisitorsModule`

### Service Responsibilities

| Service | Responsibility |
|---------|---------------|
| `VisitsService` | Visit lifecycle CRUD (create, update, cancel), paginated queries, Excel export, check-in code generation |
| `VisitParticipantService` | Visitor/escort add, update, remove (prevents removing last visitor); batch blacklist validation; access-level validation; check-in code generation; parking request data in visitor response |
| `VisitStatusService` | Access events (arrived, check-in, check-out), on-site queries (batch blacklist), visitor history, auto-checkout |
| `BlacklistService` | Blacklist CRUD, batch lookups, notifications |
| `ParkingRequestService` | Parking request creation (auto-approve or pending), review (approve/deny), paginated queries |

### Batch Blacklist Lookups

Blacklist checks use batch methods to avoid N+1 queries:
- `checkBlacklistStatusBatch(idNumbers[])` — single DB query for multiple person IDs
- `checkVehicleBlacklistStatusBatch(carNumbers[])` — single DB query for multiple car numbers
- Used in: `VisitStatusService.findOnSiteVisitors()`, `VisitParticipantService.validateVisitorsNotBlacklisted()`

All blacklist lookups (single and batch) filter through `isEntryActive()`, which handles:
- **Permanent entries** (`isPermanent: true`) — always active while `isActive` is true
- **Time-limited entries** — active only when today falls within `startDate`–`endDate` range
- **Expired/future entries** — correctly excluded from results

### Controller Conventions

Controllers are thin — they route to services and do not contain:
- WS/notification emission (moved to services)
- Fire-and-forget side effects (moved to services)
- Business logic

## Settings Module

The settings module is decomposed into focused sub-modules:

```text
backend/src/settings/
├── settings.module.ts              # Core settings: SettingsService, AD config, retention, card templates
├── notifications.module.ts         # NotificationsModule: SMS + email pipeline
├── settings.service.ts             # App settings CRUD
├── ad-configuration.service.ts     # AD configuration
├── ad-search.service.ts            # AD user search
├── retention-cleanup.service.ts    # Data retention cleanup
├── card-template.service.ts        # Card template CRUD
├── sms-notification.service.ts     # SMS notification orchestration
├── sms-template.service.ts         # SMS template CRUD
├── sms-template-renderer.service.ts # SMS template rendering
├── sms-provider.service.ts         # SMS provider integration
├── email-notification.service.ts   # Email notification orchestration
├── email-template.service.ts       # Email template CRUD
├── email-template-renderer.service.ts # Email template rendering
├── email-provider.service.ts       # Email provider integration
└── notification-settings.service.ts # Per-event notification configuration
```

### NotificationsModule

`NotificationsModule` owns the SMS and email notification pipeline. Extracted from `SettingsModule` so notification concerns are isolated:

- **Provides**: SMS + email services (template, renderer, provider, notification)
- **Exports**: All SMS + email services (template, renderer, provider, notification, and settings)
- **Controllers**: Registered in `SettingsModule` (before `SettingsController`) to avoid wildcard `:key` route conflicts. `NotificationsModule` itself has no controllers.
- **Re-exported by**: `SettingsModule` (for backward compatibility)

#### Notification Events

Each event supports per-target-group SMS templates. The `SmsTemplate` entity uses a composite unique constraint on `(event, targetGroup)`, allowing separate template text and recipients per group.

Target groups: `system_users`, `visitors`, `escorts`, `visit_requester`.

| Event | Enum | Trigger | Recipient Logic |
|-------|------|---------|-----------------|
| `visit_created` | `VisitCreated` | Visit creation | Per-group SMS template recipients |
| `visit_updated` | `VisitUpdated` | Visit update | Per-group SMS template recipients |
| `visit_deleted` | `VisitDeleted` | Visit soft-delete | Per-group SMS template recipients |
| `visitor_arrived` | `VisitorArrived` | Access event marks visitor arrived | Per-group SMS template recipients |
| `visitor_blacklisted` | `VisitorBlacklisted` | Access event detects blacklisted visitor | Per-group SMS template recipients |
| `check_in_code_sent` | `CheckInCodeSent` | Check-in code generation | Per-group SMS template recipients |
| `parking_request_decision` | `ParkingRequestDecision` | Parking request approved/denied | Per-group SMS template recipients |
| `visitor_checked_out` | `VisitorCheckedOut` | Visitor completes checkout | Per-group SMS template recipients |
| `visitor_overstay` | `VisitorOverstay` | Visitor still checked in after visit end time | Per-group SMS template recipients |

#### SMS Template Placeholders

| Placeholder | Description |
|-------------|-------------|
| `{{visit.title}}` | Visit title |
| `{{visit.startTime}}` | Planned start datetime |
| `{{visit.endTime}}` | Planned end datetime |
| `{{visit.hostName}}` | Visit requester/host name |
| `{{visit.siteName}}` | Site name |
| `{{visit.purposeOfVisit}}` | Purpose of visit |
| `{{visitor.firstName}}` | Visitor first name |
| `{{visitor.lastName}}` | Visitor last name |
| `{{visitor.personId}}` | Visitor ID number |
| `{{visitor.phone}}` | Visitor phone |
| `{{visitor.company}}` | Visitor company |
| `{{visitor.carNumber}}` | Visitor car number |
| `{{visitor.checkInCode}}` | Check-in code |
| `{{parking.status}}` | Parking request status (approved/denied) |
| `{{parking.reviewNote}}` | Parking review note |

## Printing Module

```text
backend/src/printing/
├── services/
│   └── printing.service.ts         # Print orchestration + WS notification to user/agent
└── printing.module.ts              # Imports DeviceCommandsModule, WorkstationsModule, WebsocketModule
```

`PrintingService.requestPrintCardAndNotify()` handles both command routing and WS notifications (user print-queued + agent execute-print), keeping the controller thin.

## Common Utilities

```text
backend/src/common/utils/
├── date.util.ts           # Timezone-aware day boundary calculation (getDayBoundsUtc)
├── date.util.spec.ts      # Tests for date utility
└── paginate.util.ts       # Generic query pagination helper
```

### Timezone Handling

All "today" filtering uses `getDayBoundsUtc()` from `common/utils/date.util.ts` to compute day boundaries in the **business timezone** rather than the server's local timezone.

- Default timezone: `Asia/Jerusalem`
- Override via env var: `BUSINESS_TIMEZONE=America/New_York`
- Used in: `VisitsService.applyTimeFilter()`, `VisitsService.getTodaySummary()`, `VisitStatusService.findOnSiteVisitors()`

### "Today" Filter Logic

The "today" filter includes both visits starting today **and** multi-day visits that overlap today:

```sql
plannedStartTimeUtc < :dayEnd
AND (
  plannedStartTimeUtc >= :dayStart
  OR (plannedEndTimeUtc IS NOT NULL AND plannedEndTimeUtc >= :dayStart)
)
```

Where `dayStart`/`dayEnd` are `Date` objects (not ISO strings) passed directly to TypeORM for reliable MSSQL `datetime2` comparison. The OR condition uses inline SQL parentheses (not TypeORM `Brackets`) with unique parameter names to avoid driver-level parameter conflicts.

This ensures:
- Single-day visits starting today are shown
- Multi-day visits where today falls between start and end are shown
- Past visits (both start and end before today) are excluded
- Visits with NULL end time only show if they start today