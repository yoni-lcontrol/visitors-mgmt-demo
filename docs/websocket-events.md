# WebSocket Events Contract

## Overview

WebSocket communication uses socket.io via NestJS `@nestjs/platform-socket.io`. The WebSocket layer serves two purposes:

1. **Server-to-client push notifications** — all modules broadcast data change events (legacy root namespace + `/ws/users`)
2. **Realtime device command flows** — printer/scanner commands are backend-mediated WebSocket flows

## Architecture

### Namespaces

| Namespace | Purpose | Authentication |
|-----------|---------|----------------|
| `/` (root) | Legacy push notifications (backward compat) | JWT |
| `/ws/users` | User realtime commands + notifications | JWT |
| `/ws/agents` | Printer/scanner agent connections | HMAC-SHA256 |

### Key Principles
- Angular never calls printer/scanner services directly
- Angular sends commands only to backend via `/ws/users`
- Agents connect only to `/ws/agents` with HMAC authentication
- Backend resolves user → workstation → agent routing
- Access control remains API-based (no WebSocket agent)

## Connection

### User Connection (/ws/users)

```typescript
const socket = io('http://localhost:3000/ws/users', {
  auth: { token: 'Bearer <access_token>' },
  transports: ['websocket'],
});
```

### Agent Connection (/ws/agents)

```typescript
const socket = io('http://localhost:3000/ws/agents', {
  transports: ['websocket'],
});
// Then send agent:register with HMAC signature
socket.emit('agent:register', {
  clientId: 'printer-agent-1',
  timestamp: Date.now(),
  signature: hmacSha256(`${clientId}.${timestamp}`, secret),
  providerType: 'printer',
  machineId: 'WORKSTATION-01',
  hostname: 'ws-01.local',
  version: '1.0.0',
  capabilities: ['card-print', 'badge-print'],
});
```

### Rooms

Upon successful connection, the server automatically joins the client to these rooms:

| Room | Pattern | Purpose |
|------|---------|---------|
| User room | `user:{userId}` | Per-user notifications |
| Role rooms | `role:{roleName}` | Role-targeted broadcasts |
| Global room | `global` | System-wide broadcasts |

## Event Naming Convention

```
{module}:{entity}:{action}
```

**Actions:** `created`, `updated`, `deleted`, `status-changed`, `imported`

## Event Catalog

### Auth Events

| Event | Direction | Room | Payload | Description |
|-------|-----------|------|---------|-------------|
| `auth:force-logout` | Server → Client | `user:{userId}` | `{ reason: string }` | Force user to logout (password changed, account disabled) |
| `auth:permissions-changed` | Server → Client | `user:{userId}` | `{ userId: string }` | User's permissions have changed, should re-fetch |

### Users Events

| Event | Direction | Room | Payload |
|-------|-----------|------|---------|
| `users:user:created` | Server → Client | `global` | `{ id, email, firstName, lastName }` |
| `users:user:updated` | Server → Client | `global` | `{ id, email, firstName, lastName }` |
| `users:user:deleted` | Server → Client | `global` | `{ id }` |

### Access Control Events

| Event | Direction | Room | Payload |
|-------|-----------|------|---------|
| `access-control:controller:created` | Server → Client | `global` | `{ id, name, status }` |
| `access-control:controller:updated` | Server → Client | `global` | `{ id, name, status }` |
| `access-control:controller:deleted` | Server → Client | `global` | `{ id }` |
| `access-control:controller:status-changed` | Server → Client | `global` | `{ id, status, previousStatus }` |
| `access-control:door:created` | Server → Client | `global` | `{ id, name, controllerId }` |
| `access-control:door:updated` | Server → Client | `global` | `{ id, name, controllerId }` |
| `access-control:door:deleted` | Server → Client | `global` | `{ id }` |
| `access-control:extension:created` | Server → Client | `global` | `{ id, name, controllerId }` |
| `access-control:extension:updated` | Server → Client | `global` | `{ id, name, controllerId }` |
| `access-control:extension:deleted` | Server → Client | `global` | `{ id }` |
| `access-control:import:completed` | Server → Client | `user:{userId}` | `{ totalImported, errors, summary }` |
| `access-control:import:failed` | Server → Client | `user:{userId}` | `{ error }` |

### Visitors Events

| Event | Direction | Room | Payload |
|-------|-----------|------|---------|
| `visitors:visitor:created` | Server → Client | `global` | `{ id, firstName, lastName, hostUserId, visitDate }` |
| `visitors:visitor:updated` | Server → Client | `global` | `{ id, status }` |
| `visitors:visitor:checked-in` | Server → Client | `global` | `{ id, checkInAt }` |
| `visitors:visitor:checked-out` | Server → Client | `global` | `{ id, checkOutAt }` |
| `visitors:visitor:deleted` | Server → Client | `global` | `{ id }` |

### Settings Events

| Event | Direction | Room | Payload |
|-------|-----------|------|---------|
| `settings:setting:updated` | Server → Client | `global` | `{ key, value, group }` |

### System Events

| Event | Direction | Room | Payload |
|-------|-----------|------|---------|
| `system:notification` | Server → Client | Target room | `{ type, title, message }` |
| `system:maintenance` | Server → Client | `global` | `{ startsAt, message }` |

## Client-Side Usage Example

```typescript
// In a component
this.wsService.on<ControllerPayload>('access-control:controller:created')
  .pipe(takeUntilDestroyed())
  .subscribe(data => {
    this.notificationService.info(`Controller "${data.name}" added`);
    this.refreshControllerList();
  });
```

## Server-Side Broadcasting Example

```typescript
// In a service, after creating an entity
this.wsGateway.broadcastToRoom('global', 'access-control:controller:created', {
  id: controller.id,
  name: controller.name,
  status: controller.status,
});
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid JWT on connect | Connection rejected with `unauthorized` error |
| Token expires while connected | Client stays connected; uses refresh flow on next REST call |
| Server restart | Client auto-reconnects with exponential backoff |
| Network drop | Client auto-reconnects (socket.io built-in) |
| Invalid HMAC on agent register | Agent disconnected with error event |
| Expired HMAC timestamp | Agent disconnected with error event |
| Disabled agent in DB | Agent disconnected with error event |
| Agent registration timeout (15s) | Agent disconnected |
| No printer agent for workstation | Print-failed event sent to user |
| Agent disconnect during command | Command result → failed, user notified |
| Command timeout (30s) | Command log → timeout, user notified |

## Workstation Binding

Workstation binding is now performed via REST API, not WebSocket.

**API Endpoint:** `POST /api/workstations/bind`

**Auth:** JWT Bearer token  
**Request Body:** `{ "workstationId": "uuid" }`  
**Response (200 OK):** `{ "workstationId", "code", "displayName", "devices[]" }`

### Session Restore

**API Endpoint:** `GET /api/workstations/session/current`

**Auth:** JWT Bearer token  
**Response (200 OK):** `{ "workstationId", "code", "displayName", "devices[]" }` or `null` if no active session.

On page reload, the frontend calls this endpoint to restore the active workstation session and device status. This avoids losing the bound workstation state that is otherwise held only in memory (BehaviorSubject). The endpoint returns the same shape as the bind response, including current device connectivity.

The following WebSocket events are retained for backward compatibility (server push) but are no longer used by the frontend to initiate binding:

| Event | Direction | Payload |
|-------|-----------|---------|
| `workstation:bind-current-session` | User → Backend | `{ workstationId }` (deprecated — use REST API) |
| `workstation:bind-success` | Backend → User | `{ workstationId, code, displayName, devices[] }` |
| `workstation:bind-failed` | Backend → User | `{ reason }` |

## Device Status Events (User ↔ Backend)

| Event | Direction | Payload |
|-------|-----------|---------|
| `devices:status:get-current` | User → Backend | `{}` |
| `devices:status:current` | Backend → User | `{ devices[] }` |
| `devices:printer:status-changed` | Backend → User | `{ workstationId, providerType, isConnected, agentVersion }` |
| `devices:scanner:status-changed` | Backend → User | `{ workstationId, providerType, isConnected, agentVersion }` |

> **Note:** Device status change events (`devices:printer:status-changed`, `devices:scanner:status-changed`) are emitted only to users who have an active `UserWorkstationSession` bound to the affected workstation. The backend looks up active sessions via `WorkstationSessionService.findActiveSessionsByWorkstation(workstationId)` and emits to each user's `user:{userId}` room. Users not bound to that workstation do not receive the event.

## Print Card Flow

Print card requests are initiated via HTTP API, not WebSocket. The backend handles permission checks, printer routing, and sends the command to the agent via WebSocket. Progress updates are pushed to the client via WebSocket.

### API Endpoint

```
POST /api/visits/:visitId/visitors/:visitorId/print-card
```

**Auth:** JWT Bearer token (requires `visits.print-card` permission)

**Request Body:**
```json
{ "cardTemplateId?": "string", "printOptions?": {} }
```

> **Card template resolution:** If `cardTemplateId` is omitted, the backend automatically resolves it from the bound workstation's `defaultCardTemplateId`. Resolution order: explicit request value → workstation default → none.

**Response (202 Accepted):**
```json
{ "correlationId": "uuid", "status": "queued" }
```

### WebSocket Progress Events (Backend → User)

| Event | Direction | Payload |
|-------|-----------|---------|
| `visits:visitor:print-queued` | Backend → User | `{ correlationId, visitId, visitorId }` |
| `visits:visitor:print-started` | Backend → User | `{ correlationId }` |
| `visits:visitor:print-completed` | Backend → User | `{ correlationId, visitId, visitorId }` |
| `visits:visitor:print-failed` | Backend → User | `{ correlationId, visitId, visitorId, reason }` |

> **Note:** The `visits:visitor:print-request` WebSocket event (User → Backend) has been removed. Print card requests must use the HTTP API endpoint above.

## Scanner Events (User ↔ Backend)

| Event | Direction | Payload |
|-------|-----------|---------|
| `scanner:action:request` | User → Backend | `{ actionType, metadata? }` |
| `scanner:action:completed` | Backend → User | `{ correlationId, result }` |
| `scanner:action:failed` | Backend → User | `{ correlationId, reason }` |

## Agent Events (Agent ↔ Backend)

| Event | Direction | Payload |
|-------|-----------|---------|
| `agent:register` | Agent → Backend | `{ clientId, timestamp, signature, providerType, machineId, hostname, version, capabilities }` |
| `agent:registered` | Backend → Agent | `{ agentId, workstationId }` |
| `agent:enroll` | Agent → Backend | `{ enrollmentToken, providerType, machineId, hostname, version, capabilities }` |
| `agent:enrolled` | Backend → Agent | `{ clientId, clientSecret, workstationId }` |
| `agent:heartbeat` | Agent → Backend | `{ clientId, timestamp }` |
| `agent:status:update` | Agent → Backend | `{ status, scannerType?, scannerState?, previousState? }` |
| `agent:command-ack` | Agent → Backend | `{ correlationId }` |
| `agent:command-result` | Agent → Backend | `{ correlationId, success, result?, errorMessage? }` |
| `agent:error` | Backend → Agent | `{ reason }` |
| `agent:execute-print` | Backend → Agent | `{ correlationId, visitId, visitorId, cardTemplateId?, printData, printOptions? }` |

> **`printData` contents:** The backend populates `printData` with visitor fields (`fullName`, `department`, `cardNumber`, `qrValue`, `title`, `image`, `id`) loaded from the Visitor entity. When a card template is resolved, `printData.templateJson` contains the template elements JSON from the CardTemplate. The printer agent dispatches based on `printData` contents: `templateJson` present → template print, `fullName` + `id` → simple card print, `text` → text print.

| `agent:execute-scan` | Backend → Agent | `{ correlationId, actionType, metadata? }` |
| `agent:get-status` | Backend → Agent | `{}` |
| `agent:ping` | Backend → Agent | `{}` |

### Provider-Aware Command Result Routing

When the backend receives `agent:command-result`, it routes the result to the appropriate user-facing event based on the `providerType` of the original command:

| Provider | Success Event | Failure Event |
|----------|---------------|---------------|
| `scanner` | `scanner:action:completed` | `scanner:action:failed` |
| `printer` | `visits:visitor:print-completed` | `visits:visitor:print-failed` |

This routing is tracked in the `DeviceCommandRoutingService` pending commands map, which stores the `providerType` and `commandType` alongside the user socket and correlation ID.
