# Architecture Overview

## System Architecture

Migdal is a multi-tier web application:

```
┌─────────────────────────────────────────────────┐
│              Angular Frontend                    │
│  (SPA, lazy-loaded feature modules)             │
│  - HTTP REST calls via interceptor              │
│  - WebSocket for realtime updates               │
│  - Route guards for auth + permissions          │
└────────────┬───────────────┬────────────────────┘
             │ REST (HTTPS)  │ WebSocket (WSS)
             ▼               ▼
┌─────────────────────────────────────────────────┐
│              NestJS Backend                      │
│  - Modular architecture                         │
│  - JWT auth with Passport strategies            │
│  - Microsoft Entra ID (Azure AD) support        │
│  - Permission-based guards                      │
│  - Global exception filters                     │
│  - Structured logging (Pino)                    │
│  - Swagger API docs                             │
│  - WebSocket gateway (socket.io)                │
│  - /ws/users (browser) + /ws/agents (devices)   │
└────────┬──────────────┬─────────────────────────┘
         │ TypeORM      │ WebSocket (/ws/agents)
         ▼              ▼
┌────────────────┐  ┌─────────────────────────────┐
│  MS SQL Server │  │  Device Agents (per WS)     │
│  - Users       │  │  ┌────────────────────────┐ │
│  - Roles       │  │  │ Scanner Service (C#)   │ │
│  - Permissions │  │  │ - Acuant/Gemalto SDK   │ │
│  - Visitors    │  │  │ - HMAC auth            │ │
│  - Settings    │  │  │ - socket.io client     │ │
│  - Audit Logs  │  │  │ - USB lifecycle mgmt   │ │
│                │  │  └────────────────────────┘ │
│  - Workstations│  │  ┌────────────────────────┐ │
│  - DeviceAgents│  │  │ Printer Agent (.NET 9) │ │
│  - CommandLogs │  │  │ - CuCustomWnd SDK      │ │
│                │  │  │ - Template rendering   │ │
│                │  │  │ - HMAC auth            │ │
│                │  │  │ - socket.io client     │ │
└────────────────┘  │  └────────────────────────┘ │
                    └─────────────────────────────┘
```

## Architecture Principles

1. **Modular Boundaries**: Each domain has its own NestJS module with clear imports/exports
2. **Layered Architecture**: Controller → Service → Repository (TypeORM) → Database
3. **Dependency Inversion**: Services depend on abstractions, not concrete implementations
4. **Single Responsibility**: Each class/file has one reason to change
5. **Convention over Configuration**: Consistent naming, structure, and patterns throughout
6. **Security First**: JWT validation on every request, permission checks on every endpoint
7. **Fail Fast**: Validation at API boundary with class-validator, global exception filters

## Communication Patterns

### REST API
- All standard CRUD/business operations go through REST endpoints
- Standard CRUD patterns with consistent response format
- Pagination, sorting, filtering on list endpoints
- Swagger-documented with DTOs

### WebSocket
- **Push notifications**: Backend broadcasts events when data changes (all modules)
- **Realtime device command flows**: Printer/scanner commands are backend-mediated WebSocket flows
  - Browser users connect to `/ws/users` (JWT authenticated)
  - Printer/scanner agents connect to `/ws/agents` (HMAC authenticated)
  - Backend resolves user → workstation → agent routing
  - Angular never calls printer/scanner services directly
- **Workstation binding**: Users select their workstation post-login or from a dropdown (`GET /workstations/accessible`). Binding is done via `POST /api/workstations/bind` with `{ workstationId }`. The backend validates access (via `WorkstationUsers` / `WorkstationRoles` tables), creates a `UserWorkstationSession`, and returns device status. On page reload, the frontend calls `GET /api/workstations/session/current` to restore the active session and device connectivity state.
- **Agent enrollment**: Admins create enrollment tokens per workstation/provider-type. Agents connect to `/ws/agents`, send `agent:enroll` with the token. Backend validates, creates `DeviceAgent` with HMAC credentials, returns credentials. Agent reconnects with HMAC for regular operation.
- **Device status targeting**: When a printer/scanner agent connects or disconnects, the backend looks up active `UserWorkstationSessions` for that workstation and emits device status change events only to those users' `user:{userId}` rooms — not to all connected clients.
- Legacy root-namespace WebSocket preserved for backward compatibility

### Device Command Flow (Example: Print Card)

```
Angular           Backend (/ws/users)    Backend (/ws/agents)    Printer Agent
  │                     │                      │                      │
  │ [JWT socket]        │                      │                      │
  │ workstation:bind ──>│                      │                      │
  │ <── bind-success ───│                      │                      │
  │                     │                      │                      │
  │ print-request ─────>│                      │                      │
  │                     │ check permission     │                      │
  │                     │ resolve workstation  │                      │
  │                     │ resolve agent        │                      │
  │                     │ create command log   │                      │
  │ <── print-queued ───│                      │                      │
  │                     │ execute-print ──────>│ ────────────────────>│
  │                     │                      │ <── command-ack ─────│
  │ <── print-started ──│                      │                      │
  │                     │                      │ <── command-result ──│
  │ <── print-completed─│                      │                      │
```

Each workstation can have a **default card template** (`defaultCardTemplateId`). When a print request omits `cardTemplateId`, the `PrintingService` resolves it from the user's bound workstation automatically. Resolution chain: explicit request value → workstation default → none.

Card templates also support **test printing** via `POST /settings/card-templates/:id/test-print` (permission: `visits.print-card`). This follows the same device command routing flow but with `commandType: 'test-print-template'` and sample data instead of a real visitor.

### Device Command Flow (Example: Scan ID)

```
Angular           Backend (/ws/users)    Backend (/ws/agents)    Scanner Agent
  │                     │                      │                      │
  │ [JWT socket]        │                      │                      │
  │ workstation:bind ──>│                      │                      │
  │ <── bind-success ───│                      │                      │
  │                     │                      │                      │
  │ scanner:action:req─>│                      │                      │
  │  { actionType }     │ check permission     │                      │
  │                     │ resolve workstation  │                      │
  │                     │ resolve agent        │                      │
  │                     │ create command log   │                      │
  │                     │ execute-scan ───────>│ ────────────────────>│
  │                     │                      │ <── command-ack ─────│
  │                     │                      │   (scan in progress) │
  │                     │                      │ <── command-result ──│
  │ <── scanner:action  │                      │   { personId, ...}   │
  │     :completed ─────│                      │                      │
```

The scanner agent also supports **auto-detect** mode: when a document is placed in the tray without a prior command, the agent scans and sends the result as `agent:command-result` with an `auto-*` correlation ID. The backend routes the result based on providerType (scanner → `scanner:action:completed`, printer → `visits:visitor:print-completed`).

### Access Control Integration
- One external instance, API-based only
- No WebSocket agent registration for access control
- Communicates via REST API adapter (HMAC authenticated)

### Data Flow (Example: Creating a User)

```
Angular                   NestJS                    MSSQL
  │                         │                         │
  │ POST /api/users ────────>│                         │
  │ (JWT in header)          │ JwtAuthGuard validates  │
  │                          │ PermissionsGuard checks │
  │                          │ ValidationPipe validates│
  │                          │ Service.create() ───────>│ INSERT INTO Users
  │                          │ <───────────── entity   │
  │                          │ WebSocket.broadcast()   │
  │ <─── 201 Created ───────│                         │
  │                          │                         │
  │ <─── WS: users:created ─│ (to other clients)      │
```

## Module Dependency Graph

```
AppModule
├── ConfigModule (global)
├── LoggerModule (global)
├── DatabaseModule
├── CommonModule (global - guards, filters, interceptors)
├── WebSocketModule
│   ├── UsersGateway (/ws/users - JWT auth, user commands)
│   ├── AgentsGateway (/ws/agents - HMAC auth, agent commands)
│   └── WebsocketGateway (root - legacy push notifications)
├── AuthModule
│   └── depends on: UsersModule
├── UsersModule
│   └── depends on: RolesModule
├── RolesModule
│   └── depends on: PermissionsModule
├── PermissionsModule
├── AccessControlModule
├── VisitorsModule
│   └── depends on: UsersModule (for host user)
├── SettingsModule
├── WorkstationsModule
├── AgentsModule
│   └── depends on: WorkstationsModule
├── DeviceCommandsModule
│   └── depends on: AgentsModule, WorkstationsModule
├── PrintingModule
│   └── depends on: DeviceCommandsModule
├── ScanningModule
│   └── depends on: DeviceCommandsModule
└── IntegrationsModule (inbound HTTP events, API-only)
```

## Security Architecture

- **Transport**: HTTPS in production, HTTP in development
- **Authentication**: JWT bearer tokens (access + refresh)
- **Authorization**: RBAC with permission-level granularity
- **Password Storage**: bcrypt with salt rounds = 12
- **CORS**: Restricted to known frontend origins
- **Rate Limiting**: Applied to auth endpoints (optional, recommended for production)
- **Input Validation**: class-validator on all DTOs
- **SQL Injection**: Prevented by TypeORM parameterized queries
- **XSS**: HttpOnly cookies for refresh tokens, sanitized responses

## Scalability Considerations

- Stateless backend (JWT) — easily horizontal scalable
- WebSocket can be scaled with Redis adapter (socket.io-redis)
- Database connection pooling via TypeORM
- Feature modules are independently deployable if needed
- Environment-based configuration for different deployment targets
