# Architecture Overview

## System Architecture

Migdal is a multi-tier web application. Printer/scanner hardware is reached by each agent (`migdal-printer-service`, `migdal-scanner-service`) acting as an HMAC-authenticated Socket.IO client on `/ws/agents` (`AgentSocketClient.cs`) — but the agent host has **no network path to the backend at all**. The only address it's ever configured with is the front server's public origin (the same host the kiosk SPA is served from); the front server's IIS reverse proxy (`migdal-kiosk/web.config`) is what actually forwards that traffic on to the backend's internal port. The kiosk browser reaches the backend the exact same way, over a separate namespace, `/ws/kiosk` (API-key authenticated) — it's already same-origin with that reverse proxy since it's served by the same site. The backend, once traffic reaches it either way, relays between the two: it resolves card templates and builds print jobs, routes commands to whichever agent is connected for a given workstation, and pushes status/results back to the kiosk over its socket. **The backend is now on the path for every device interaction, but it is never directly reachable from the agent host** — there is no separate broker process, and no new port is opened: agents, kiosk, and backend all appear behind the SPA's existing public port, with the front server as the one thing anything outside the backend's own trusted network is allowed to talk to.

This replaces an earlier design (`migdal-kiosk-broker`, since deleted) where the kiosk browser and the printer/scanner agents paired directly with each other through a same-origin IIS-hosted WebSocket relay, with the backend uninvolved in the print/scan path itself. That relay is gone; both agents and the kiosk now always go through the backend, and the Admin SPA's staff print-card feature (previously dormant because no agent was ever connected to `/ws/agents`) now works the same way.

```
                                     ┌──────────────────────────────┐
                                     │  Device Agent host           │
                                     │  (network-isolated — the     │
                                     │  ONLY address it has is the  │
                                     │  front server's public host) │
                                     │  ┌─────────────────────────┐ │
                                     │  │ Scanner Service (C#)    │ │
                                     │  │ Acuant/Gemalto SDK      │ │
                                     │  │ AgentSocketClient.cs    │ │
                                     │  └─────────────────────────┘ │
                                     │  ┌─────────────────────────┐ │
                                     │  │ Printer Agent (.NET 9)  │ │
                                     │  │ CuCustomWnd SDK         │ │
                                     │  │ AgentSocketClient.cs    │ │
                                     │  └─────────────────────────┘ │
                                     └───────────────┬───────────────┘
                                                      │ Socket.IO, HMAC —
                                                      │ dials the front server's
                                                      │ public host, same as the
                                                      │ kiosk SPA below
                                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│ "Front" server — one IIS site, one machine                       │
│ ┌─────────────────┐  ┌──────────────────────────────────────────┐ │
│ │ Admin SPA        │  │ Kiosk SPA (migdal-kiosk)                 │ │
│ │ (migdal-frontend)│  │ static files + web.config reverse proxy: │ │
│ │ static files     │  │  /api/* , /socket.io/* -> backend:3000   │◄│── (agent traffic lands here too)
│ └────────┬─────────┘  └────────────────────┬──────────────────────┘ │
└──────────┼────────────────────────────────┼────────────────────────┘
           │ REST + WS (direct,              │ REST + WS (proxied —
           │ no reverse proxy)               │  same public port as the SPA;
           ▼                                  │  carries both /ws/kiosk and
┌────────────────────────────────────┐        │  /ws/agents traffic)
│  NestJS Backend                     │        ▼
│  - JWT auth, Kerberos/Windows SSO   │◄───────┘
│  - Permission-based guards          │
│  - Structured logging (Pino)        │
│  - WebSocket gateway (socket.io):   │
│    - /ws/users  (admin SPA, live)   │
│    - /ws/agents (HMAC auth, live —  │
│      printer/scanner agents)        │
│    - /ws/kiosk  (API-key auth,      │
│      live — kiosk SPA)              │
└────────────────┬─────────────────────┘
                 │ TypeORM
                 ▼
┌─────────────────────────┐
│  MS SQL Server          │
│  - Users, Roles, Perms  │
│  - Visitors, Settings   │
│  - Audit Logs           │
│  - Workstations         │
│  - DeviceAgents         │
│  - CommandLogs          │
└─────────────────────────┘
```

Admin SPA and Kiosk SPA are two static-file sites on the **same physical machine**, served by the same IIS instance. The kiosk SPA's site additionally reverse-proxies `/api` and `/socket.io` to the backend (via `migdal-kiosk/web.config`, requiring ARR + URL Rewrite + the `IIS-WebSockets` feature on that machine) so the kiosk browser and the backend appear same-origin without opening a new port. The Admin SPA talks to the backend directly (`/ws/users`, plus REST) rather than through that proxy. The printer/scanner agent host is not on that machine and is not on the backend's network at all — its **only** configured address (`FrontServerUrl`) is the front server's public origin, and it reaches `/ws/agents` exclusively by riding the same `/socket.io` reverse-proxy rule the kiosk SPA uses. There is no direct network path from the agent host to the backend, by design — that isolation is the whole reason the agent host can only ever be configured with one address.

As of now, both agents (`migdal-printer-service`, `migdal-scanner-service`) run `AgentSocketClient.cs` — an outbound HMAC-authenticated Socket.IO client to the backend's `/ws/agents` namespace. There is no `KioskSocketServer.cs`/broker client in either project anymore.

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

- **Push notifications** (`/ws/users`, JWT authenticated): the backend broadcasts events when data changes (all modules). The Admin SPA's staff print-card feature is also routed this way — see "Staff Print Flow" below.
- **`/ws/agents`** (HMAC authenticated, `AgentsGateway`): printer and scanner agents connect here directly as Socket.IO clients (`AgentSocketClient.cs` in both `migdal-printer-service` and `migdal-scanner-service`). Both the Admin SPA's staff print flow and the kiosk's print/scan flow route through this same namespace.
- **`/ws/kiosk`** (API-key authenticated via `KIOSK_API_KEY`, `KioskGateway`): the kiosk SPA connects here. Printing is still triggered over REST (`POST /visits/kiosk/print-card`, `POST /visits/kiosk/arrive`) — this namespace is backend→kiosk only, for scanner/printer connectivity status (`kiosk:scanner-status`/`kiosk:printer-status`), scan requests/results (`kiosk:request-scan` → `kiosk:scan-status`/`kiosk:scan-result`), and print status/results (`kiosk:print-status`/`kiosk:print-result`).

- **Workstation binding**: Users select their workstation post-login or from a dropdown (`GET /workstations/accessible`). Binding is done via `POST /api/workstations/bind` with `{ workstationId }`. The backend validates access (via `WorkstationUsers` / `WorkstationRoles` tables), creates a `UserWorkstationSession`, and returns device status. On page reload, the frontend calls `GET /api/workstations/session/current` to restore the active session and device connectivity state.
- **Agent enrollment**: Admins can create enrollment tokens per workstation/provider-type (Workstations admin UI); an agent without stored HMAC credentials sends `agent:enroll` on first connect and persists the returned `clientId`/`clientSecret` locally, using `agent:register` (HMAC-signed) on every connect after that.
- **Device status targeting**: When a printer/scanner agent connects or disconnects on `/ws/agents`, the backend looks up active `UserWorkstationSessions` for that workstation and emits device status change events only to those users' `user:{userId}` rooms, and pushes the corresponding `kiosk:scanner-status`/`kiosk:printer-status` to any kiosk registered on that workstation's `/ws/kiosk` room.
- **Two agent types, one workstation**: a workstation can have both a scanner agent and a printer agent connected at once. `AgentsGateway` stamps each socket with the `providerType` it registered as, so command routing, acks, and results are classified per-socket rather than inferred from correlationId shape.

### Kiosk Print/Scan Flow

The kiosk (`migdal-kiosk`) connects to the backend's `/ws/kiosk` namespace via `socket.io-client`, reached at the same origin as the kiosk SPA (`migdal-kiosk/web.config` reverse-proxies `/socket.io/*` and `/api/*` to the backend — see "Deploying the reverse proxy" below). The printer/scanner agents connect to `/ws/agents` on their own network-isolated host. The backend sits in the middle of every command:

```
Kiosk (browser)              Backend                              Printer/Scanner Agent
  │                             │                                         │
  │ [socket.io, auth.apiKey]    │                                         │
  │ kiosk:register ────────────>│  looks up workstation by code           │
  │ <── kiosk:registered ───────│  joins workstation:{id} room            │
  │                             │                                         │
  │ POST visits/kiosk/print-card ──>│  build printData, routeKioskCommand │
  │ <── { ok, correlationId } ──│  emit agent:execute-print ─────────────>│
  │ <── kiosk:print-status(queued) │                                     │
  │                             │  <── agent:command-ack ─────────────────│
  │ <── kiosk:print-status(printing) │                                   │
  │                             │  <── agent:command-result ──────────────│
  │ <── kiosk:print-status(completed/failed) │                           │
  │ <── kiosk:print-result ─────│                                         │
  │                             │                                         │
  │ kiosk:request-scan ────────>│  emit agent:execute-scan ──────────────>│
  │                             │  <── agent:command-result ──────────────│
  │ <── kiosk:scan-result ──────│  (photo included, unstripped)          │
```

Every print/scan dispatched this way is persisted as a `DeviceCommandLog` row (`requestedByUserId: null` for kiosk-originated commands, distinguishing them from staff-initiated ones). A command that times out (30s, no `agent:command-result`) or whose agent disconnects mid-flight produces a `kiosk:print-result`/`kiosk:scan-result` with `success: false` rather than leaving the kiosk UI hanging.

### Staff Print Flow

The Admin SPA (`migdal-frontend`) has a staff-facing "print visitor card" feature that also routes through `/ws/agents`, sharing `agent:execute-print`/`agent:command-result` with the kiosk flow above — the printer agent has no notion of which UI requested a print; the distinction (`origin: 'user' | 'kiosk'`) lives entirely on the backend's pending-command record.

```
Admin SPA         Backend (/ws/users)    Backend (/ws/agents)    Printer Agent
  │                     │                      │                     │
  │ [JWT socket]        │                      │                     │
  │ workstation:bind ──>│                      │                     │
  │ <── bind-success ───│                      │                     │
  │                     │                      │                     │
  │ print-request ─────>│                      │                     │
  │                     │ check permission     │                     │
  │                     │ resolve workstation  │                     │
  │                     │ resolve agent ───────│                     │
  │                     │ create command log   │                     │
  │ <── print-queued ───│  emit agent:execute-print ─────────────────>│
  │                     │  <── agent:command-result ───────────────────│
  │ <── print-completed/failed (via /ws/users) │                     │
```

Each workstation can have a **default card template** (`defaultCardTemplateId`). When a print request omits `cardTemplateId`, `PrintingService` resolves it from the workstation automatically. Resolution chain: explicit request value → workstation default → none.

Card templates also support **test printing** via `POST /settings/card-templates/:id/test-print` (permission: `visits.print-card`), following the same flow above with `commandType: 'test-print-template'` and sample data instead of a real visitor.

### Deploying the reverse proxy

There is no standalone broker process anymore. Agents, the kiosk, and the backend share the front server's existing kiosk-SPA site/port:

- Install the **ARR (Application Request Routing)** and **URL Rewrite** IIS modules, and enable **"Enable proxy"** under ARR's server-level "Server Proxy Settings" (not settable from web.config).
- Enable the `IIS-WebSockets` Windows feature on the front server (needed for the `/socket.io` WebSocket upgrade to proxy through).
- `migdal-kiosk/web.config` (deployed alongside the built SPA, `dist/migdal-kiosk`) proxies `/api/*` and `/socket.io/*` to the backend's internal port and falls back everything else to `index.html` for Angular routing.
- Agent hosts (network-isolated) are configured with the front server's public origin — this is the *only* address they know — via `FrontServerUrl` in each agent's `appsettings.json`/`App.config`. They never see or use the backend's own address; the reverse proxy above is what actually gets their traffic there.

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
│   ├── UsersGateway (/ws/users - JWT auth, user commands - live, used by Admin SPA)
│   ├── AgentsGateway (/ws/agents - HMAC auth - live, printer/scanner agents)
│   ├── KioskGateway (/ws/kiosk - API-key auth - live, kiosk SPA)
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
│   └── depends on: DeviceCommandsModule, WebSocketModule (emits agent:execute-print / kiosk:print-status via AgentsGateway/KioskGateway)
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
