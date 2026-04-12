# Frontend Structure (Angular)

## Overview

The Angular frontend uses standalone components with lazy-loaded feature routes. No NgModules are used for feature modules — Angular's modern standalone API is preferred.

Authentication supports both local username/password login and Microsoft Entra ID (Azure AD) via MSAL.js (`@azure/msal-browser`). The login page dynamically shows the Microsoft sign-in button when Entra ID is configured. After either authentication method, the user is redirected to `/select-workstation` to choose their workstation for the session. They may skip if no workstation is needed. Once a workstation is selected (or skipped), the user enters the main application.

## Project Layout

```
frontend/src/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ main.ts                         # Bootstrap with providers
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.html                      # HTML entry point
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ styles.scss                     # Global styles
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ environments/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ environment.ts              # Development config
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ environment.prod.ts         # Production config
Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ app/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ app.component.ts            # Root component
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ app.component.html
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ app.routes.ts               # Top-level route definitions
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ app.config.ts               # provideRouter, provideHttpClient, etc.
    Ã¢â€â€š
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ core/                       # Singleton services, guards, interceptors
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ auth/
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ auth.service.ts         # Login/logout, token management
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ auth.guard.ts           # Route guard: requires authentication
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ auth.interceptor.ts     # Attaches JWT, handles 401 refresh
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ token.service.ts        # Token storage (in-memory)
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ auth.models.ts          # LoginRequest, LoginResponse, User
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ permissions/
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ permission.service.ts   # Check permissions, cache current user perms
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ permission.guard.ts     # Route guard: requires specific permission
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ has-permission.directive.ts  # *hasPermission structural directive
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ websocket/
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ websocket.service.ts    # socket.io client, auto-connect/reconnect
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ws-events.enum.ts       # Event name constants (shared with backend)
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ api/
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ api.service.ts          # Base HTTP service with typed methods
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ services/
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ notification.service.ts # Toast/snackbar notifications
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å"Ã¢â€â‚¬Ã¢â€â‚¬ loading.service.ts      # Global loading state
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å"Ã¢â€â‚¬Ã¢â€â‚¬ confirm.service.ts      # Shared confirmation dialogs (PrimeNG + i18n)
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å"Ã¢â€â‚¬Ã¢â€â‚¬ workstation-session.service.ts  # Workstation bind state via WebSocket
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ device-status.service.ts       # Device status via WebSocket
    Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ models/
    Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ api-response.model.ts   # Standard API response interface
    Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ paginated-result.model.ts
    Ã¢â€â€š
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ shared/                     # Reusable presentational components
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ components/
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ data-table/             # Generic data table with pagination
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ confirm-dialog/         # Confirmation modal
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ page-header/            # Page title + breadcrumbs
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ loading-spinner/        # Spinner overlay
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pipes/
    Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ date-format.pipe.ts
    Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ directives/
    Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ debounce-click.directive.ts
    Ã¢â€â€š
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ layout/                     # Application shell (authenticated)
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ layout.component.ts         # Sidebar + header + router-outlet
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ layout.component.html
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ header/
    │   │   ├── header.component.ts     # Top bar: user menu, notifications
    │   │   ├── header.component.html
    │   │   └── agent-status-icons.component.ts  # Printer/scanner status icons (green=connected, red=disconnected)
    │   └── sidebar/
    Ã¢â€â€š       Ã¢â€Å"Ã¢â€â‚¬Ã¢â€â‚¬ sidebar.component.ts    # Navigation menu, permission-aware
    Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ sidebar.component.html
    Ã¢â€â€š
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ features/                   # Lazy-loaded feature areas
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ auth/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ auth.routes.ts          # /login
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ login/
        Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ login.component.ts
        Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ login.component.html
        |   +-- select-workstation/
        |   |   +-- select-workstation.component.ts    # Post-login workstation picker
        |   |   +-- select-workstation.component.spec.ts
        Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ services/
        Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ auth-api.service.ts # POST /auth/login, /auth/refresh
        Ã¢â€â€š
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ users/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ users.routes.ts          # /users, /users/:id
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ user-list/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ user-detail/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ user-form/
        Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ services/
        Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ users-api.service.ts
        Ã¢â€â€š
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ roles/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ roles.routes.ts
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ role-list/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ role-form/
        Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ services/
        Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ roles-api.service.ts
        Ã¢â€â€š
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ access-control/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ access-control.routes.ts
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ controllers/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ doors/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ extensions/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ door-ios/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ extension-ios/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ import/
        Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ services/
        Ã¢â€â€š
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ visitors/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ visitors.routes.ts
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ visitor-list/
        Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ visitor-form/
        Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ services/
        |       |__ visitor-print.service.ts  # Print card via WS (per-component)

        Ã¢â€â€š
        Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ settings/
            Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ settings.routes.ts
            Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ settings-list/
            Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ setting-form/
            Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ services/
```

## Notification Settings

`NotificationSettingsComponent` is a standalone single-file component that manages:

1. **Notification toggle matrix** — per-event × per-target-group toggles for SMS and email channels
2. **SMS templates** — editable per event × target group, with preview and test-SMS
3. **Email templates** — editable subject + HTML body per event × target group, with preview and test-email

The screen is split into two columns: SMS templates on the left, Email templates on the right, sharing a common group-tab selector. Both template types use the same card-based layout pattern. Placeholders (e.g. `{{visit.title}}`) are shared and displayed in a collapsible reference section.

**API endpoints used:**
- `GET/PUT /settings/notifications` — toggle matrix
- `GET/PUT /settings/sms-templates` — SMS templates CRUD
- `POST /settings/sms-templates/preview` — preview rendered SMS
- `POST /settings/sms-templates/test` — send test SMS
- `GET /settings/sms-templates/placeholders` — available placeholders
- `GET/PUT /settings/email-templates` — Email templates CRUD
- `POST /settings/email-templates/preview` — preview rendered email (subject + body)
- `POST /settings/email-templates/test` — send test email

## Routing Strategy

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', loadChildren: () => import('./features/auth/auth.routes') },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'users',          loadChildren: () => import('./features/users/users.routes'),
        canActivate: [permissionGuard], data: { permission: 'users.read' } },
      { path: 'roles',          loadChildren: () => import('./features/roles/roles.routes'),
        canActivate: [permissionGuard], data: { permission: 'roles.read' } },
      { path: 'access-control', loadChildren: () => import('./features/access-control/access-control.routes'),
        canActivate: [permissionGuard], data: { permission: 'access-control.read' } },
      { path: 'visitors',       loadChildren: () => import('./features/visitors/visitors.routes'),
        canActivate: [permissionGuard], data: { permission: 'visits.read' } },
      { path: 'settings',       loadChildren: () => import('./features/settings/settings.routes'),
        canActivate: [permissionGuard], data: { permission: 'settings.read' } },
    ]
  },
  { path: '**', redirectTo: '' }
];
```

## State Management

**Decision: No NgRx.** This application is primarily CRUD-based. State management is handled by:

- `AuthService` Ã¢â‚¬â€ BehaviorSubject for current user + auth state
- `PermissionService` Ã¢â‚¬â€ derived from auth state, caches permissions
- Feature API services Ã¢â‚¬â€ each feature has its own service for HTTP calls
- `WebSocketService` Ã¢â‚¬â€ Observable streams for realtime events

If application complexity grows significantly (offline mode, complex undo/redo, collaborative editing), NgRx can be introduced per-feature without refactoring the whole app.

## Key Patterns

### Token Flow
1. Login Ã¢â€ â€™ store access token in `TokenService` (in-memory variable)
2. `AuthInterceptor` attaches `Authorization: Bearer <token>` to requests
3. On 401 Ã¢â€ â€™ intercept, call refresh endpoint, retry original request
4. On refresh failure Ã¢â€ â€™ clear state, redirect to /login

### Permission-Based UI
- **Route level**: `permissionGuard` checks route's `data.permission`
- **Component level**: `*hasPermission="'users.create'"` directive shows/hides elements
- **Service level**: `PermissionService.hasPermission('users.create')` for programmatic checks

### WebSocket Integration
- `WebSocketService` connects after login, disconnects on logout
- `UserWebSocketService` connects to `/ws/users` namespace for device commands (print, scan, device status)
- Returns typed `Observable<T>` for each event
- Feature components subscribe and react (e.g., refresh list when entity changes)
- `VisitorPrintService` manages print card lifecycle per visitor (provided per-component, not root)
- `ScannerEventService` listens for `scanner:action:completed` / `scanner:action:failed` events only when the user is bound to a workstation. Subscribes on workstation bind, unsubscribes on unbind, and resets on logout.

### Print Card Availability
- Print buttons in both visit-detail and card-template views check `isPrinterAvailable()` before enabling
- `isPrinterAvailable()` requires: workstation bound (`WorkstationSessionService.currentState.bound`) **and** printer connected (`WorkstationSessionService.isPrinterConnected()`)
- Buttons show contextual tooltips: "Select a workstation first" or "No printer connected" when disabled
- `printCard()` guard prevents print requests when printer is unavailable
- Consistent pattern used across `VisitDetailComponent`, `CardTemplateListComponent`, and `CardDesignerComponent`

### Workstation Admin (Settings)
- `WorkstationListComponent` under Settings provides admin CRUD for workstations (requires `workstations.read`)
- Table shows: code, display name, description, machine ID, device status, assigned roles count
- Create/Edit dialog for workstation fields (edit mode includes inline role assignment toggles, default card template dropdown)
- Agent enrollment dialog: select provider type → generate one-time token → display for agent installer
- Route: `/settings/workstations`, permission-gated to `workstations.read`

## Visit Detail Component Structure

The visit-detail component delegates display responsibilities to child components:

| Component | Purpose | Inputs | Outputs |
|-----------|---------|--------|---------|
| `VisitDialogComponent` | Create/edit visit dialog with inline visitors, escorts, blacklist check, AD search | visible, editing, accessLevels, buildings | visibleChange, saved |
| `VisitVisitorsTableComponent` | Visitors data table with status badges and actions | visitors, codeMap, loading, printingVisitorId, printerConnected | registerEvent, editVisitor, resendCode, regenerateCode, showHistory, printCard, removeVisitor |
| `VisitEscortsTableComponent` | Escorts data table with edit/delete | escorts, loading | editEscort, removeEscort |
| `VisitHistoryDialogComponent` | Visitor access event history dialog | visible, items, loading | visibleChange |

### Visit Dialog Defaults

When creating a **new** visit, `VisitDialogComponent.open()` pre-fills:
- **Start time**: 08:00
- **End time**: 17:00
- Start/end **dates** remain unset (user must select)

When **editing**, the existing visit times are used as-is.

The parent `VisitDetailComponent` retains:
- Visit info card and summary bar
- Add/edit visitor dialogs (with person blacklist check, vehicle blacklist check, parking request, and person search)
- Add/edit escort dialogs (with AD autocomplete)
- All API call orchestration and state management

### Parking Requests

The parking feature adds:
- **`ParkingRequestsComponent`** (`/visits/parking-requests`): Approval page for users with `parking.approve` permission. Shows paginated table of parking requests with approve/deny actions and review note dialog.
- **Vehicle form checkbox**: Both `VisitDialogComponent` and `VisitDetailComponent` show a "Request parking space" checkbox inside the vehicle section when the user has `parking.request` permission.
- **Sidebar item**: "Parking Requests" link under Visitors Management, gated by `parking.approve`.
- **API methods**: `getParkingRequests()`, `getPendingParkingCount()`, `reviewParkingRequest()` in `VisitsApiService`.

## Multi-Site Support

### SiteContextService (`core/services/site-context.service.ts`)

Central service managing the active site context across the application:

- **`activeSite$`**: `BehaviorSubject<Site | null>` — emits when the user switches sites
- **`availableSites$`**: List of sites the current user is assigned to (from JWT `siteIds`)
- **`switchSite(siteId)`**: Updates the active site, persists selection
- Initialized after login from the user's JWT payload

### Site Selector (Header)

The header displays a site selector dropdown when the user has multiple assigned sites. Switching the site triggers `SiteContextService.switchSite()`, which causes all subscribed list pages to re-fetch data filtered by the new site.

### Multi-Site Filtering in List Pages

All major list pages inject `SiteContextService` and pass `siteId` in their API calls:

| Page | Service Method | Behavior |
|------|---------------|----------|
| `VisitListComponent` | `visits.findAll({ siteId })` | Filters visits by site |
| `BuildingListComponent` | `buildings.findAll({ siteId })` | Filters buildings by site |
| `WorkstationListComponent` | `workstations.findAll(siteId)` | Filters workstations by site |
| `AuditLogListComponent` | `audit.findAll({ siteId })` | Filters audit logs by site |
| `BlacklistListComponent` | `blacklist.findAll({ siteId })` | Filters blacklist entries by site |

Each page subscribes to `activeSite$` and re-fetches data when the active site changes. On create/edit, the active `siteId` is auto-set on new records.

### User-Site Assignment UI

The user create/edit dialog (`UserListComponent`) includes a sites toggle grid (same pattern as the roles grid):

- Loads all active sites via `SitesApiService.getAllActive()`
- For existing users, loads current assignments via `SitesApiService.getUserSites(userId)`
- On save, calls `SitesApiService.assignUserToSites(userId, siteIds)` after user create/update

### SitesApiService (`features/settings/services/sites-api.service.ts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getAll()` | `GET /sites` | List all sites (admin, paginated) |
| `getAllActive()` | `GET /sites/active` | List active sites (for dropdowns) |
| `getUserSites(userId)` | `GET /sites/users/:userId/sites` | Get sites assigned to a user |
| `assignUserToSites(userId, siteIds)` | `POST /sites/assign-users/:userId` | Assign user to sites |
