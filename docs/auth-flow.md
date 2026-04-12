# Authentication & Authorization Flow

## Authentication Strategy

### Token Architecture

| Token | Type | TTL | Storage | Purpose |
|-------|------|-----|---------|---------|
| Access Token | JWT | 15 minutes | In-memory (Angular service) | API authorization |
| Refresh Token | JWT | 7 days | HttpOnly cookie + DB hash | Silent re-authentication |

### Login Flow

```
┌──────────┐                      ┌──────────┐                    ┌──────┐
│ Frontend  │                      │ Backend   │                    │  DB  │
└────┬─────┘                      └────┬─────┘                    └──┬───┘
     │                                  │                             │
     │ POST /api/auth/login             │                             │
     │ { email, password }              │                             │
     │ ─────────────────────────────────>                             │
     │                                  │                             │
     │                                  │ Find user by email          │
     │                                  │ ────────────────────────────>
     │                                  │ <────────────────────────────
     │                                  │                             │
     │                                  │ bcrypt.compare(password,    │
     │                                  │   user.passwordHash)        │
     │                                  │                             │
     │                                  │ Load user roles+permissions │
     │                                  │ ────────────────────────────>
     │                                  │ <────────────────────────────
     │                                  │                             │
     │                                  │ Generate access token (JWT) │
     │                                  │ Generate refresh token (JWT)│
     │                                  │ Hash refresh token → save   │
     │                                  │ ────────────────────────────>
     │                                  │                             │
     │  200 OK                          │                             │
     │  Body: { accessToken, user }     │                             │
     │  Cookie: refreshToken (HttpOnly) │                             │
     │ <─────────────────────────────────                             │
     │                                  │                             │
     │ Store accessToken in memory      │                             │
     │ Store user state                 │                             │
     │ Connect WebSocket                │                             │
     │ GET /workstations/accessible     │                             │
     │ ─────────────────────────────────>                             │
     │ <─────────────────────────────────                             │
     │ If list.length > 0 → navigate    │                             │
     │   to /select-workstation         │                             │
     │ Else → navigate to /dashboard    │                             │
```

### Post-Login Workstation Selection

After successful login (local or Entra), the frontend checks `GET /workstations/accessible`.
If the user has accessible workstations, they are redirected to `/select-workstation` to choose one.
If no workstations are assigned (via user or role), the user is sent directly to `/dashboard`, skipping the picker entirely.
The user selects a workstation, which triggers `POST /api/workstations/bind` with the workstation ID.
On successful bind, the API returns the workstation info and device status, and the user is navigated to `/dashboard`.
The user may also skip this step and proceed without a bound workstation.

WebSocket is used only for receiving real-time events (device status changes, print results, etc.), not for sending commands from the frontend.

On page reload, the frontend calls `GET /api/workstations/session/current` to restore the active workstation session. If a session exists, the response includes the workstation info and current device connectivity, allowing the navbar status icons (printer/scanner) to render immediately without requiring the user to re-bind.

### Token Refresh Flow

```
     │ API call returns 401             │                             │
     │ <─────────────────────────────────                             │
     │                                  │                             │
     │ POST /api/auth/refresh           │                             │
     │ (Cookie: refreshToken)           │                             │
     │ ─────────────────────────────────>                             │
     │                                  │                             │
     │                                  │ Validate refresh JWT        │
     │                                  │ Find token hash in DB       │
     │                                  │ Check not revoked/expired   │
     │                                  │                             │
     │                                  │ Issue new access token      │
     │                                  │ Rotate refresh token        │
     │                                  │ (invalidate old, issue new) │
     │                                  │                             │
     │  200 OK                          │                             │
     │  Body: { accessToken }           │                             │
     │  Cookie: new refreshToken        │                             │
     │ <─────────────────────────────────                             │
     │                                  │                             │
     │ Retry original request           │                             │
     │ with new access token            │                             │
```

### Logout Flow

```
     │ POST /api/auth/logout            │                             │
     │ (Cookie: refreshToken)           │                             │
     │ (Header: Authorization)          │                             │
     │ ─────────────────────────────────>                             │
     │                                  │                             │
     │                                  │ Revoke refresh token in DB  │
     │                                  │ ────────────────────────────>
     │                                  │                             │
     │  200 OK                          │                             │
     │  Cookie: clear refreshToken      │                             │
     │ <─────────────────────────────────                             │
     │                                  │                             │
     │ Clear access token from memory   │                             │
     │ Clear user state                 │                             │
     │ Reset workstation session state  │                             │
     │ Disconnect WebSocket             │                             │
     │ Navigate to /login               │                             │
```

## JWT Payload

### Access Token Payload

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440001",
  "username": "admin",
  "roles": ["Admin"],
  "roleIds": ["role-id-1"],
  "permissions": [
    "users.create",
    "users.read",
    "users.update",
    "roles.read"
  ],
  "iat": 1711411200,
  "exp": 1711412100
}
```

### Login / Refresh Response User Object

The `user` object returned in login, refresh, and `/auth/me` responses:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "username": "admin",
  "firstName": "Admin",
  "lastName": "User",
  "email": "admin@migdal.local",
  "phone": "050-1234567",
  "roles": ["Admin"],
  "permissions": ["users.create", "users.read"]
}
```

`email` and `phone` may be `null` if not set on the user record.
```

### Refresh Token Payload

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440001",
  "tokenId": "a1b2c3d4-...",
  "iat": 1711411200,
  "exp": 1712016000
}
```

## Authorization Strategy

### Backend Guards

1. **JwtAuthGuard** (global, applied to all routes by default)
   - Validates access token
   - Populates `request.user`
   - Skipped on routes decorated with `@Public()`

2. **PermissionsGuard** (applied selectively via decorator)
   - Reads `@RequirePermissions('users.create')` metadata
   - Checks `request.user.permissions` array
   - Returns 403 if permission not found

### Backend Usage Example

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {

  @Post()
  @RequirePermissions('users.create')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user.id);
  }

  @Get()
  @RequirePermissions('users.read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }
}
```

### Frontend Guards

1. **authGuard** — functional guard, checks if user is authenticated
2. **permissionGuard** — functional guard, reads `route.data.permission` and checks via `PermissionService`

### Frontend UI Permission Control

```html
<!-- Show button only if user has permission -->
<button *hasPermission="'users.create'">Add User</button>

<!-- Hide entire section -->
<div *hasPermission="'settings.update'">
  <app-settings-form></app-settings-form>
</div>
```

## Security Measures

| Measure | Implementation |
|---------|---------------|
| Password storage | bcrypt with 12 salt rounds |
| Access token exposure | In-memory only (not localStorage) — safe from XSS |
| Refresh token exposure | HttpOnly + Secure + SameSite cookie — safe from XSS and CSRF |
| Token rotation | Each refresh generates new refresh token and revokes old |
| Concurrent sessions | Multiple refresh tokens per user (per device) |
| Brute force | Rate limiting on login endpoint (recommended) |
| Token revocation | Refresh tokens stored in DB, can be revoked on logout or admin action |

## Microsoft Entra ID Authentication

### Overview

The application supports authentication via Microsoft Entra ID (Azure AD) in addition to local username/password login. After successful Entra authentication, the backend issues the same local JWT tokens (access + refresh), so all existing authorization logic remains unchanged.

### Architecture

- **Frontend**: Uses MSAL.js (`@azure/msal-browser`) with Authorization Code Flow + PKCE
- **Backend**: Validates Microsoft-issued ID tokens via JWKS, resolves/provisions local users, issues app JWTs
- **Protocol**: OpenID Connect (OIDC)

### Entra Login Flow

```
┌──────────┐           ┌──────────────┐           ┌──────────┐         ┌──────┐
│ Frontend  │           │ Microsoft    │           │  Backend  │         │  DB  │
│ (MSAL)    │           │ Entra ID     │           │           │         │      │
└────┬─────┘           └──────┬───────┘           └────┬─────┘         └──┬───┘
     │                         │                        │                   │
     │ loginPopup()            │                        │                   │
     │ (Auth Code + PKCE)      │                        │                   │
     │ ────────────────────────>                        │                   │
     │                         │                        │                   │
     │  User authenticates     │                        │                   │
     │  with Microsoft         │                        │                   │
     │                         │                        │                   │
     │ <────────────────────────                        │                   │
     │ ID token + auth result  │                        │                   │
     │                         │                        │                   │
     │ POST /api/auth/entra-login                       │                   │
     │ { idToken }             │                        │                   │
     │ ─────────────────────────────────────────────────>                   │
     │                         │                        │                   │
     │                         │  Fetch JWKS keys       │                   │
     │                         │ <──────────────────────                    │
     │                         │ ──────────────────────>                    │
     │                         │                        │                   │
     │                         │  Verify signature,     │                   │
     │                         │  issuer, audience,     │                   │
     │                         │  expiry                │                   │
     │                         │                        │                   │
     │                         │                        │ Find user by      │
     │                         │                        │ externalAuthId    │
     │                         │                        │ ──────────────────>
     │                         │                        │ <──────────────────
     │                         │                        │                   │
     │                         │                        │ (or by email,     │
     │                         │                        │  or auto-provision│
     │                         │                        │  if enabled)      │
     │                         │                        │                   │
     │                         │                        │ Load roles +      │
     │                         │                        │ permissions       │
     │                         │                        │ ──────────────────>
     │                         │                        │ <──────────────────
     │                         │                        │                   │
     │                         │                        │ Generate local    │
     │                         │                        │ access + refresh  │
     │                         │                        │ tokens (JWT)      │
     │                         │                        │                   │
     │  200 OK                                          │                   │
     │  Body: { accessToken, user }                     │                   │
     │  Cookie: refreshToken (HttpOnly)                 │                   │
     │ <─────────────────────────────────────────────────                   │
     │                         │                        │                   │
     │ Same as local login:    │                        │                   │
     │ Store token, navigate   │                        │                   │
```

### User Mapping Strategy

When a user authenticates via Entra ID, the backend resolves the local user in this order:

1. **By `externalAuthId`**: Matches the Entra `oid` claim (unique per user per tenant). Used for returning users.
2. **By email/UPN**: If no `externalAuthId` match, falls back to matching by email or UPN. On first match, links the external identity to the local user.
3. **Auto-provision** (optional): If `ENTRA_AUTO_PROVISION=true` and no local user is found, creates a new user with the configured default role.

### User Entity Fields

| Field | Type | Purpose |
|---|---|---|
| `externalAuthProvider` | nvarchar(50) | Identity provider name (e.g., `entra`) |
| `externalAuthId` | nvarchar(255) | External identity ID (Entra `oid` claim) |
| `lastExternalLoginAt` | datetime2 | Timestamp of last external login |

### Configuration

Environment variables (backend `.env`):

| Variable | Description | Example |
|---|---|---|
| `ENTRA_TENANT_ID` | Microsoft Entra tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `ENTRA_CLIENT_ID` | Application (client) ID registered in Entra | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `ENTRA_REDIRECT_URI` | Frontend redirect URI | `http://localhost:4200` |
| `ENTRA_AUTO_PROVISION` | Auto-create users on first Entra login | `false` |
| `ENTRA_DEFAULT_ROLE` | Role assigned to auto-provisioned users | `Viewer` |

Frontend environment (`environment.ts`):

```typescript
entra: {
    clientId: '',      // Same as ENTRA_CLIENT_ID
    tenantId: '',      // Same as ENTRA_TENANT_ID
    redirectUri: 'http://localhost:4200',
}
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/entra-login` | Public | Exchange Entra ID token for local JWT |
| `GET` | `/api/auth/entra-config` | Public | Get Entra client configuration (enabled, clientId, tenantId) |

### Post-Entra Login Behavior

After successful Entra login, the application behaves identically to local password login:
- Local access token (JWT) is issued with same payload format
- Refresh token is stored as HttpOnly cookie
- Same token refresh and rotation flow applies
- Same permission guards and RBAC enforcement
- Same logout flow (revokes refresh token)
- Same post-login workstation selection flow (`/select-workstation`)

### Audit Logging

Entra logins are logged with action `ENTRA_LOGIN`. Auto-provisioned users are logged with action `AUTO_PROVISION`.

## Device Agent HMAC Authentication

### Overview

Printer/scanner agents connect to the backend via a dedicated WebSocket namespace (`/ws/agents`) using HMAC-SHA256 authentication — not JWT. This ensures agents are authenticated as registered devices without requiring user-level credentials.

### Agent Registration in DB

Each agent has a `DeviceAgents` record with:
- `clientId` — unique identifier for the agent
- `secretHash` — stored hash of the shared secret
- `workstationId` — FK to the workstation the agent belongs to
- `providerType` — `printer` or `scanner`
- `isEnabled` — must be `true` for connections to be accepted

### WebSocket Handshake Flow

```
┌──────────┐                      ┌──────────┐                    ┌──────┐
│  Agent    │                      │ Backend   │                    │  DB  │
└────┬─────┘                      └────┬─────┘                    └──┬───┘
     │                                  │                             │
     │ WebSocket connect /ws/agents     │                             │
     │ auth: { clientId, timestamp,     │                             │
     │         signature }              │                             │
     │ ─────────────────────────────────>                             │
     │                                  │                             │
     │                                  │ Lookup DeviceAgent by       │
     │                                  │ clientId                    │
     │                                  │ ────────────────────────────>
     │                                  │ <────────────────────────────
     │                                  │                             │
     │                                  │ Validate:                   │
     │                                  │ - agent exists & isEnabled  │
     │                                  │ - timestamp within skew     │
     │                                  │ - HMAC signature matches    │
     │                                  │                             │
     │  Connection accepted             │                             │
     │ <─────────────────────────────────                             │
     │                                  │                             │
     │ emit('agent:register', {         │                             │
     │   providerType, machineId,       │                             │
     │   hostname, version,             │                             │
     │   capabilities })                │                             │
     │ ─────────────────────────────────>                             │
     │                                  │                             │
     │                                  │ Update DeviceAgent with     │
     │                                  │ connection state            │
     │                                  │ ────────────────────────────>
     │                                  │                             │
     │  emit('agent:registered', {      │                             │
     │    agentId,                      │                             │
     │    workstationId })              │                             │
     │ <─────────────────────────────────                             │
```

### Signature Computation

```
payload = "{clientId}.{timestamp}"
signature = HMAC-SHA256(payload, sharedSecret).hexDigest()
```

- `timestamp` must be within `AGENT_HMAC_MAX_SKEW_MS` (default: 300000 = 5 minutes)
- Agent must have `isEnabled = true` in the database
- After successful handshake, the agent must emit `agent:register` within 15 seconds or the connection is closed

### Agent Heartbeat

Agents send periodic `agent:heartbeat` events. If no heartbeat is received within the stale threshold, the agent connection is marked `Stale` and cleaned up.
