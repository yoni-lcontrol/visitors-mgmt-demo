# Integrations Platform

Reusable inbound integrations platform for external machine-to-machine (M2M) event delivery.

## Architecture

```
integrations/
├── common/                          # Shared infrastructure
│   ├── entities/
│   │   └── external-event-log.entity.ts   # ExternalEventLogs table
│   ├── enums/
│   │   ├── inbound-event-status.enum.ts   # Received → Processed/Duplicate/Failed/Ignored
│   │   └── integration-provider.enum.ts   # AccessControl | Scanner | Printer | Amadeus
│   ├── guards/
│   │   └── integration-hmac.guard.ts      # HMAC-SHA256 authentication
│   ├── interfaces/
│   │   ├── inbound-event.interface.ts     # Canonical event shape
│   │   └── integration-client-config.interface.ts
│   ├── services/
│   │   ├── integration-auth.service.ts    # Client lookup + HMAC verification
│   │   └── inbound-event-log.service.ts   # Event log CRUD + idempotency
│   └── integrations-common.module.ts      # Shared module for all providers
├── access-control/                  # Access control provider
│   ├── dto/
│   ├── adapters/
│   ├── access-control-events.controller.ts
│   ├── access-control-events.service.ts
│   └── access-control-integration.module.ts
├── scanner/                         # Scanner provider (same structure)
├── printer/                         # Printer provider (same structure)
├── amadeus/                         # Amadeus access-control bridge
│   ├── dto/
│   │   └── create-amadeus-event.dto.ts    # Validated DTO matching BackendAmadeusEventDto
│   ├── adapters/
│   │   └── amadeus-event.adapter.ts       # Maps DTO → InboundEvent
│   ├── amadeus-events.controller.ts       # POST batch + single endpoints
│   ├── amadeus-events.service.ts          # Event processing + WS broadcast
│   └── amadeus-integration.module.ts

**Note**: The Amadeus event ingestion module lives in `src/amadeus/` (not under `src/integrations/`) because it also serves M2M equipment and sync endpoints. It imports `IntegrationsCommonModule` to reuse `InboundEventLogService` for idempotency and event logging.
└── integrations.module.ts           # Root module
```

## Authentication

All integration endpoints use **HMAC-SHA256** authentication (not JWT). Routes are marked `@Public()` to skip JWT and use `@UseGuards(IntegrationHmacGuard)`.

### Required Headers

| Header | Description |
|---|---|
| `x-client-id` | Registered client identifier |
| `x-timestamp` | Unix timestamp (ms) — must be within 5min skew |
| `x-signature` | HMAC-SHA256 hex digest |

### Signature Computation

```
payload = "{clientId}.{timestamp}.{rawBody}"
signature = HMAC-SHA256(payload, clientSecret).hexDigest()
```

### Configuration

Set `INTEGRATIONS_CLIENTS_JSON` environment variable:

```json
[
  {
    "clientId": "ac-system-1",
    "provider": "access-control",
    "secret": "your-256-bit-secret-here",
    "enabled": true
  }
]
```

Optional: `INTEGRATIONS_HMAC_MAX_SKEW_MS` (default: 300000 = 5 minutes)

## Endpoints

| Method | Path | Provider |
|---|---|---|
| POST | `/api/integrations/access-control/events` | Access Control |
| POST | `/api/integrations/scanner/events` | Scanner |
| POST | `/api/integrations/printer/events` | Printer |
| POST | `/api/events/amadeus` | Amadeus (batch) |
| GET | `/api/events/amadeus` | Amadeus (recent realtime event history) |
| GET | `/api/controllers` | Amadeus (equipment) |
| GET | `/api/doors` | Amadeus (equipment) |
| GET | `/api/door-ios` | Amadeus (equipment) |
| GET | `/api/extensions` | Amadeus (equipment) |
| GET | `/api/extension-ios` | Amadeus (equipment) |
| POST | `/api/sync/full` | Amadeus (sync) |

### Request Shape (example: access-control)

```json
{
  "eventId": "evt-001",
  "eventType": "access_granted",
  "occurredAt": "2024-06-15T10:30:00Z",
  "doorId": "door-main",
  "controllerId": "ctrl-1",
  "cardNumber": "CARD-555",
  "personId": "visitor-42",
  "description": "Access granted at main entrance",
  "correlationId": "req-abc-123"
}
```

### Response Shape

```json
{ "status": "processed", "eventId": "uuid-of-log" }
```

Possible `status` values: `processed`, `duplicate`, `failed`

## Event Processing Flow

1. **HMAC Guard** validates headers, timestamp, and signature
2. **Controller** adapts DTO → canonical `InboundEvent` via adapter
3. **Idempotency check** — if `(provider, externalEventId)` exists, return `duplicate`
4. **Save** raw event log to `ExternalEventLogs` table
5. **Process** via provider service (domain-specific logic)
6. **Mark** log as `processed` or `failed`
7. **Broadcast** WebSocket event to all connected clients

## WebSocket Events

| Event | Trigger |
|---|---|
| `integrations:access-control:event-received` | Access control event processed |
| `integrations:scanner:event-received` | Scanner event processed |
| `integrations:printer:event-received` | Printer event processed |

## Database

Table: `ExternalEventLogs`

Key columns: `id`, `provider`, `clientId`, `externalEventId`, `eventType`, `payloadJson`, `signature`, `receivedAt`, `processedAt`, `status`, `errorMessage`, `correlationId`

Indexes:
- Unique filtered: `(provider, externalEventId)` WHERE `externalEventId IS NOT NULL`
- `provider`, `status`, `receivedAt`

Migration: `1777000000000-AddExternalEventLogs.ts`

## Adding a New Provider

1. Create `integrations/{provider}/` directory with:
   - `dto/create-{provider}-event.dto.ts` — validated DTO
   - `adapters/{provider}-event.adapter.ts` — maps DTO → `InboundEvent`
   - `{provider}-events.service.ts` — processes events, emits WS
   - `{provider}-events.controller.ts` — POST endpoint
   - `{provider}-integration.module.ts` — imports `IntegrationsCommonModule` + `WebsocketModule`
2. Add enum value to `IntegrationProvider`
3. Add WS event to `WsEvent` enum (backend + frontend)
4. Register module in `integrations.module.ts`
5. Add tests

## Device Agent WebSocket Integration

In addition to the HTTP-based inbound event endpoints above, printer and scanner devices also connect as **WebSocket agents** via the `/ws/agents` namespace. This complements the HTTP integration:

| Channel | Purpose | Auth |
|---------|---------|------|
| `POST /api/integrations/printer/events` | Inbound event delivery (HTTP push) | HMAC via headers |
| `POST /api/integrations/scanner/events` | Inbound event delivery (HTTP push) | HMAC via headers |
| `ws://host/ws/agents` | Bidirectional command channel (print card, scan) | HMAC via handshake |

The agent HMAC authentication for WebSocket uses the same signature algorithm as the HTTP integration (see `integrations/common/services/integration-auth.service.ts`) but passes credentials via `socket.handshake.auth` instead of HTTP headers. See `docs/auth-flow.md` for details.

> **Agents never address the backend directly.** The agent host is network-isolated and is only ever configured with the front server's public origin (`FrontServerUrl`) — the same host the kiosk SPA is served from. The front server's IIS reverse proxy (`migdal-kiosk/web.config`) is what forwards that connection on to `/ws/agents`. There is no route from the agent host to the backend's own address; see `docs/architecture.md` for the full topology.

## Scanner Agent Service (C# Windows Service)

The scanner agent (`migdal-scanner-service/`) runs on workstation machines with Acuant/Gemalto ID scanners. It has no network route to the backend — it dials the front server's public origin as a Socket.IO client, and the front server's reverse proxy forwards that connection on to the backend's `/ws/agents` namespace.

### Architecture

```
migdal-scanner-service/
├── Program.cs                 # Entry point (Windows Service or console)
├── MyService.cs               # ServiceBase wrapper
├── MyServiceInstaller.cs      # Windows Service installer
├── AgentConfig.cs             # Typed config (App.config + persisted credentials)
├── AgentSocketClient.cs       # Socket.IO client for /ws/agents namespace
├── HmacAuth.cs                # HMAC-SHA256 signature generation
├── Gemalto.cs                 # Acuant/Gemalto SDK wrapper (scan + OCR)
├── ScanResult.cs              # Extracted document data model
├── ScannerSocketMessage.cs    # Command result payload wrapper
├── AcuantConstants.cs         # Scanner hardware type constants
├── AcuantCore.cs              # SDK resource/error helpers
├── AcuantUtilities.cs         # Image processing utilities
├── Logger.cs                  # Serilog configuration
├── App.config                 # Configuration (FrontServerUrl, EnrollmentToken, License)
├── ScannerService.csproj      # .NET Framework 4.7.2 project
├── ScannerService.sln         # Visual Studio solution
├── dll/                       # Native scanner SDK DLLs (NetScanW, NetScanWex)
├── packages/                  # NuGet packages (restored locally)
├── Properties/                # AssemblyInfo
└── Resources/                 # Scanner SDK error resource files
```

### Communication Flow

1. **First-time enrollment:** Admin creates enrollment token via `POST /workstations/:id/enrollment-tokens`. Token is placed in `App.config` → `EnrollmentToken`. Agent connects to `/ws/agents`, sends `agent:enroll` with the token. Backend validates, creates `DeviceAgent` record with HMAC credentials, returns `{ clientId, clientSecret }`. Agent persists credentials to `agent-credentials.json` and disconnects.

2. **Normal operation:** Agent starts, loads HMAC credentials from `agent-credentials.json`, connects to `/ws/agents`, sends `agent:register` with HMAC signature (`clientId.timestamp` signed with `clientSecret`). Backend validates via `AgentHmacAuthService`, updates the `DeviceAgent` record with live connection state (`socketId`, `isConnected`, `connectedAt`), confirms with `agent:registered`.

3. **Reconnection:** Both scanner and printer agents use a manual reconnect loop (`RunAsync` / `ExecuteAsync`). Socket.io built-in reconnection is disabled (`Reconnection = false`). On disconnect, the agent waits `ReconnectDelayMs`, creates a fresh socket, and re-sends `agent:register` with HMAC credentials. This ensures the backend always receives a valid registration after each reconnect.

3. **Receiving scan commands:** Backend sends `agent:execute-scan` with `{ correlationId, actionType }`. Agent sends `agent:command-ack`, executes scan via Gemalto SDK, sends `agent:command-result` with extracted document data.

4. **Auto-detect scanning:** Agent polls scanner tray every 500ms. When a document is detected, it scans and sends the result back via `agent:command-result` with an auto-generated correlation ID.

5. **Heartbeat:** Agent sends `agent:heartbeat` every 30s (configurable) to update `lastSeenAt` on the `DeviceAgents` table.

### Configuration (App.config)

| Key | Description | Default |
|-----|-------------|---------|
| `FrontServerUrl` | Front server's public origin (same host as the kiosk SPA) — **not** the backend's address; the agent has no route to the backend, the front server's reverse proxy forwards this on | `http://localhost:3000` |
| `EnrollmentToken` | One-time enrollment token (cleared after use) | `` |
| `MachineId` | Machine identifier | `Environment.MachineName` |
| `HeartbeatIntervalMs` | Heartbeat interval (ms) | `30000` |
| `ReconnectDelayMs` | Reconnect delay after disconnect (ms) | `5000` |
| `License` | Acuant/Gemalto SDK license key | |

After enrollment, HMAC credentials are persisted in `agent-credentials.json` (same directory as executable):

```json
{ "ClientId": "agent-scanner-a1b2c3d4...", "ClientSecret": "hex-encoded-secret" }
```

### HMAC Signature

The agent computes HMAC-SHA256 matching the backend's `AgentHmacAuthService`:

```
payload = "{clientId}.{timestampMs}"
signature = HMAC-SHA256(payload, clientSecret).hexDigest()
```

### Scanner Result Payload

When the agent sends `agent:command-result`, the `result` field contains:

```json
{
  "personId": "123456789",
  "firstName": "John",
  "lastName": "Doe",
  "identifyNumber": "ABC123",
  "image": ""
}
```

The backend routes this to the requesting user via `scanner:action:completed` (see provider-aware routing in `docs/websocket-events.md`).

## Printer Agent Service (C# .NET 9 Windows Service)

The printer agent (`migdal-printer-service/`) runs on workstation machines with USB card printers (Custom CuCustomWnd SDK). It has no network route to the backend — it dials the front server's public origin as a Socket.IO client, and the front server's reverse proxy forwards that connection on to the backend's `/ws/agents` namespace.

### Architecture

```
migdal-printer-service/
├── Program.cs                 # Entry point (Generic Host as Windows Service, no HTTP server)
├── AgentConfig.cs             # Typed config (appsettings.json + persisted credentials)
├── AgentSocketClient.cs       # Socket.IO client for /ws/agents namespace (BackgroundService)
├── HmacAuth.cs                # HMAC-SHA256 signature generation
├── PrinterManager.cs          # Printer SDK wrapper (IHostedService for SDK lifecycle)
├── appsettings.json           # Configuration (FrontServerUrl, EnrollmentToken, etc.)
├── printer-service.csproj     # .NET 9 Worker SDK, x64, WindowsForms (for System.Drawing)
├── CuCustomWndAPIWrapNET6.dll # Managed .NET wrapper for printer SDK
└── CuCustomWndAPI.dll         # Native printer SDK
```

### Communication Flow

1. **First-time enrollment:** Same flow as the scanner agent. Admin creates enrollment token via `POST /workstations/:id/enrollment-tokens`. Token is placed in `appsettings.json` → `Agent:EnrollmentToken`. Agent connects to `/ws/agents`, sends `agent:enroll` with `providerType: "printer"`. Backend validates, creates `DeviceAgent` record with HMAC credentials, returns `{ clientId, clientSecret }`. Agent persists credentials to `agent-credentials.json` and reconnects.

2. **Normal operation:** Agent starts, loads HMAC credentials from `agent-credentials.json`, connects to `/ws/agents`, sends `agent:register` with HMAC signature. Backend validates via `AgentHmacAuthService`, confirms with `agent:registered`. Agent starts heartbeat timer.

3. **Receiving print commands:** Backend sends `agent:execute-print` with `{ correlationId, visitId, visitorId, printData, printOptions }`. Agent sends `agent:command-ack`, dispatches the print to the appropriate method based on `printData` contents, then sends `agent:command-result` with success/failure.

4. **Print dispatch logic:** The agent inspects `printData` fields to determine the print type:
   - `templateJson` present → Direct template rendering via `PrintFromTemplate` (new primary flow)
   - `outerJson` present → Legacy wrapped template via `PrintFromTemplateOuterJson`
   - `fullName` + `id` present → Simple card printing (`PrintCard`)
   - `text` present → Text printing (`PrintText`)

5. **Heartbeat:** Agent sends `agent:heartbeat` every 30s (configurable) to maintain connection presence.

### Print Capabilities

| Capability | Method | Description |
|------------|--------|-------------|
| `print-template` | `PrintFromTemplate` | Renders a canvas template (elementsJson) to PNG with data substitution, QR codes, images, then prints |
| `print-template-outer` | `PrintFromTemplateOuterJson` | Legacy: extracts TemplateJson from outer wrapper, then delegates to `PrintFromTemplate` |
| `print-card` | `PrintCard` | Creates rotated text + barcode image and prints |
| `print-text` | `PrintText` | Renders text to image and prints |

Template rendering supports: text elements with placeholders (`FullName`, `Department`, `CardNumber`, `Title`, `Barcode`, date/time), image elements (base64), QR code generation, rotation, and DPI-aware sizing.

### Configuration (appsettings.json)

| Key | Description | Default |
|-----|-------------|---------|
| `Agent:FrontServerUrl` | Front server's public origin (same host as the kiosk SPA) — **not** the backend's address; the agent has no route to the backend, the front server's reverse proxy forwards this on | `http://localhost:3000` |
| `Agent:EnrollmentToken` | One-time enrollment token | `` |
| `Agent:MachineId` | Machine identifier | `Environment.MachineName` |
| `Agent:HeartbeatIntervalMs` | Heartbeat interval (ms) | `30000` |
| `Agent:ReconnectDelayMs` | Reconnect delay after disconnect (ms) | `5000` |

After enrollment, HMAC credentials are persisted in `agent-credentials.json` (same directory as executable):

```json
{ "ClientId": "agent-printer-a1b2c3d4...", "ClientSecret": "hex-encoded-secret" }
```

### HMAC Signature

Same format as the scanner agent:

```
payload = "{clientId}.{timestampMs}"
signature = HMAC-SHA256(payload, clientSecret).hexDigest()
```
