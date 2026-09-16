# Development Roadmap

## Phase Overview

```
Phase 1: Foundation          ← Architecture + Scaffolding
Phase 2: Auth & Users        ← Core functionality
Phase 3: Access Control      ← Primary business module
Phase 4: Visitors            ← Secondary business module
Phase 5: Settings & Polish   ← Admin and finalization
Phase 6: Testing & Hardening ← Quality assurance
Phase 7: Deployment Ready    ← CI/CD, Docker, production
```

## Phase 1: Foundation

**Goal:** Project structure, tooling, database connection, basic app shell.

### Backend
- [x] Architecture documentation
- [ ] NestJS project scaffold with all modules (empty shells)
- [ ] Database connection (TypeORM + MSSQL)
- [ ] Global configuration (ConfigModule)
- [ ] Global exception filters
- [ ] Global response interceptor
- [ ] Logging setup (Pino)
- [ ] Swagger setup
- [ ] WebSocket gateway skeleton
- [x] Health check endpoint

### Frontend
- [ ] Angular project scaffold
- [ ] Core module setup (services, guards, interceptors)
- [ ] Shared components (data table, page header, loading)
- [ ] Layout shell (sidebar + header + router-outlet)
- [ ] Environment configuration
- [ ] Routing skeleton

### Database
- [ ] Initial migration (all tables)
- [ ] Seed script (permissions, roles, admin user, settings, SMS templates)

---

## Phase 2: Auth & Users

**Goal:** Working login flow, user management, RBAC enforcement.

### Backend
- [ ] Auth endpoints (login, logout, refresh, me)
- [ ] JWT strategy (access + refresh)
- [ ] Password hashing service
- [ ] Refresh token storage + rotation
- [ ] User CRUD endpoints
- [ ] Role CRUD endpoints
- [ ] Permission listing endpoint
- [ ] User-role assignment endpoints
- [ ] Role-permission assignment endpoints
- [ ] Permission guard implementation
- [ ] Audit logging for auth actions
- [x] Kerberos / Windows SSO authentication support
  - [x] Backend: KerberosService (SPNEGO identity resolution, user mapping, auto-provision)
  - [x] Backend: GET /auth/kerberos-login + GET /auth/kerberos-config endpoints
  - [x] Backend: User entity fields (externalAuthProvider, externalAuthId, lastExternalLoginAt)
  - [x] Backend: Migration for external auth fields
  - [x] Frontend: Windows sign-in button on login page

### Frontend
- [ ] Login page + form
- [ ] Auth service (token management)
- [ ] HTTP interceptor (JWT attachment + refresh)
- [ ] Auth route guard
- [ ] Permission route guard
- [ ] Permission directive (*hasPermission)
- [ ] User list page
- [ ] User create/edit form
- [ ] Role management pages
- [ ] Permission assignment UI

---

## Phase 3: Access Control

**Goal:** Full CRUD + import for access control entities.

### Backend
- [ ] Controller entity + CRUD
- [ ] Door entity + CRUD
- [ ] Extension entity + CRUD
- [ ] DoorIO entity + CRUD
- [ ] ExtensionIO entity + CRUD
- [ ] Import service (bulk create/update)
- [ ] Import validation
- [ ] Status management
- [ ] WebSocket events for CRUD operations
- [ ] Relationships enforcement

### Frontend
- [ ] Access control dashboard
- [ ] Controller list + form
- [ ] Door list + form
- [ ] Extension list + form
- [ ] DoorIO list + form
- [ ] ExtensionIO list + form
- [ ] Import wizard / upload
- [ ] Relationship navigation (controller → doors → IOs)
- [ ] Status indicators
- [ ] WebSocket integration for live updates

---

## Phase 4: Visitors

**Goal:** Visitor invitation and tracking.

### Backend
- [ ] Visitor entity + CRUD
- [ ] Invitation status workflow
- [ ] Host user linking
- [ ] Check-in / check-out endpoints
- [ ] Visit time validation
- [ ] WebSocket events for visitor actions

### Frontend
- [ ] Visitor list page
- [ ] Visitor invitation form
- [ ] Status badge display
- [ ] Check-in / check-out actions
- [ ] Filter by date, status, host
- [ ] WebSocket integration

---

## Phase 5: Settings & Polish

**Goal:** System settings, UI polish, missing features.

### Backend
- [ ] Settings CRUD
- [ ] Grouped settings API
- [ ] Settings cache (optional)
- [ ] Audit log viewing endpoint

### Frontend
- [ ] Settings management page
- [ ] Grouped settings UI
- [ ] Audit log viewer (optional)
- [x] Dashboard page with summary cards
- [ ] Notification toasts
- [ ] Loading states
- [ ] Empty states
- [ ] Error pages (404, 403)

---

## Phase 6: Testing & Hardening

**Goal:** Test coverage, security hardening, performance.

- [ ] Backend unit tests (services, guards, pipes)
- [ ] Backend E2E tests (auth flow, CRUD flows)
- [ ] Frontend unit tests (services, guards, key components)
- [ ] Frontend E2E tests (login flow, navigation, CRUD)
- [ ] Security review (OWASP top 10)
- [x] PermissionsGuard global wiring (was missing — security fix)
- [x] Dead code audit & cleanup (backend + frontend)
- [ ] Rate limiting on auth endpoints
- [ ] Input sanitization review
- [ ] Performance profiling
- [ ] Load testing (optional)

---

## Phase 7: Deployment Ready

**Goal:** Production deployment capability.

- [ ] Dockerfile (backend)
- [ ] Dockerfile (frontend — Nginx)
- [ ] docker-compose.yml (full stack)
- [ ] CI/CD pipeline (GitHub Actions or Azure DevOps)
- [ ] Production environment config
- [ ] SSL/TLS setup docs
- [ ] Database backup strategy docs
- [ ] Monitoring setup (health checks, uptime)
- [ ] Deployment documentation

---

## Current Status

> **Active Phase: 1 — Foundation (Architecture & Planning)**

---

## Phase 8: Device Agent Architecture

**Goal:** WebSocket-based printer/scanner agent support with command routing.

### Backend
- [x] Workstation entity + session binding service
- [x] DeviceAgent entity (includes live connection state)
- [x] AgentHmacAuthService (HMAC-SHA256 for WS handshake)
- [x] AgentRegistryService (connect/disconnect/heartbeat)
- [x] DeviceCommandRoutingService (user → workstation → agent)
- [x] PrintingService + ScanningService
- [x] UsersGateway (/ws/users, JWT)
- [x] AgentsGateway (/ws/agents, HMAC)
- [x] Database migration (5 tables)
- [x] New permissions (visits.print-card, devices.read, devices.manage, scanner.execute)
- [x] Unit tests (40 tests passing)

### Frontend
- [x] UserWebSocketService (/ws/users namespace)
- [x] WorkstationSessionService
- [x] DeviceStatusService
- [x] VisitorPrintService
- [x] DeviceStatusIndicatorComponent
- [x] Print Card button on visit-detail
- [x] i18n translations (en + he)
