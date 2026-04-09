# Migdal Management Platform

A web-based enterprise platform built with **Angular** (frontend), **NestJS** (backend), **Microsoft SQL Server** (database), and **.NET** device agents for managing access control, visitor management, and building operations.

## Overview

Migdal is an enterprise-grade platform for managing access control systems, visitor workflows, workstation device agents, and system administration — with robust authentication, real-time updates, and granular role-based permissions.

### Key Features

- **JWT Authentication** with access + refresh tokens, Microsoft Entra ID (Azure AD) SSO
- **Role-Based Access Control (RBAC)** with 47 granular permissions across 14 modules
- **Access Control Management** — controllers, doors, extensions, IOs, access levels, cardholders
- **Visitor Management** — visits, calendar, on-site tracking, check-in codes, visitor card printing
- **Blacklist Management** — person and vehicle blacklisting with notification alerts
- **Parking Management** — parking requests and approval workflows
- **Workstation & Device Agents** — scanner and printer hardware management via WebSocket
- **Building Management** — multi-building configuration
- **Active Directory Integration** — LDAP user sync
- **Inbound Integrations** — HMAC-authenticated M2M event processing
- **System Settings** — grouped, typed, admin-editable
- **Audit Trail** — comprehensive logging with export
- **Real-time Updates** via WebSocket (socket.io) — dual namespace for browsers and device agents
- **Swagger/OpenAPI** documentation
- **Structured Logging** with Pino

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 19, TypeScript, PrimeNG, ngx-translate |
| Backend | NestJS, TypeScript, TypeORM |
| Database | Microsoft SQL Server |
| Auth | JWT (access + refresh tokens), Passport, bcrypt, Microsoft Entra ID |
| Real-time | socket.io via @nestjs/websockets (dual namespace) |
| Scanner Agent | .NET / C# — Acuant/Gemalto SDK, HMAC auth, socket.io client |
| Printer Agent | .NET 9 / C# — CuCustomWnd SDK, template rendering, HMAC auth, socket.io client |
| API Docs | Swagger / OpenAPI |
| Logging | Pino (nestjs-pino) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Angular Frontend (SPA)              │
│  - Standalone components, lazy-loaded routes     │
│  - PrimeNG UI, ngx-translate (he/en)            │
│  - HTTP REST via interceptor + WebSocket         │
│  - Route guards for auth + permissions           │
└────────────┬───────────────┬────────────────────┘
             │ REST (HTTPS)  │ WebSocket (/ws/users)
             ▼               ▼
┌─────────────────────────────────────────────────┐
│              NestJS Backend                      │
│  - Modular architecture (20+ modules)           │
│  - JWT + Entra ID auth with Passport            │
│  - Permission-based guards (47 permissions)     │
│  - Global exception filters + validation pipes  │
│  - Structured logging (Pino) + audit trail      │
│  - WebSocket gateway (socket.io)                │
│    /ws/users (JWT) + /ws/agents (HMAC)          │
│  - Inbound integrations (HMAC M2M)             │
└────────┬──────────────┬─────────────────────────┘
         │ TypeORM      │ WebSocket (/ws/agents)
         ▼              ▼
┌────────────────┐  ┌─────────────────────────────┐
│  MS SQL Server │  │  Device Agents (per WS)     │
│                │  │  ┌────────────────────────┐ │
│  - Users       │  │  │ Scanner Service (C#)   │ │
│  - Roles       │  │  │ - Acuant/Gemalto SDK   │ │
│  - Permissions │  │  │ - USB lifecycle mgmt   │ │
│  - Visitors    │  │  └────────────────────────┘ │
│  - Blacklist   │  │  ┌────────────────────────┐ │
│  - Visits      │  │  │ Printer Agent (.NET 9) │ │
│  - Workstations│  │  │ - CuCustomWnd SDK      │ │
│  - Buildings   │  │  │ - Template rendering   │ │
│  - AuditLogs   │  │  │ - USB disconnect detect│ │
│  - Settings    │  │  └────────────────────────┘ │
│  - DeviceAgents│  └─────────────────────────────┘
│  - CommandLogs │
└────────────────┘
```

## Project Structure

```
migdal_v2/
├── migdal-backend/            # NestJS API server
│   └── src/
│       ├── access-control/    # Controllers, doors, extensions, IOs, access levels
│       ├── agents/            # Device agent registration & management
│       ├── audit/             # Audit logging & export
│       ├── auth/              # JWT, refresh tokens, Entra ID SSO
│       ├── buildings/         # Building management
│       ├── common/            # Enums, guards, pipes, decorators, constants
│       ├── database/          # TypeORM config, migrations, seeds
│       ├── device-commands/   # Command dispatch to scanner/printer agents
│       ├── health/            # Health check endpoint
│       ├── integrations/      # Inbound M2M event processing (HMAC)
│       ├── logger/            # Pino structured logging
│       ├── permissions/       # Permission CRUD & grouping
│       ├── printing/          # Visitor card printing & templates
│       ├── roles/             # Role CRUD & permission assignment
│       ├── scanning/          # Document scanning orchestration
│       ├── scheduled-tasks/   # Cron jobs & scheduled operations
│       ├── settings/          # System settings (grouped, typed)
│       ├── test-utils/        # Shared test helpers & mocks
│       ├── users/             # User CRUD, AD sync
│       ├── visitors/          # Visits, visitors, blacklist, parking
│       ├── websocket/         # Socket.io gateway (users + agents)
│       └── workstations/      # Workstation CRUD & device status
├── migdal-frontend/           # Angular web application
│   └── src/app/
│       ├── core/              # Services, guards, interceptors, models
│       ├── features/
│       │   ├── access-control/  # Controllers, doors, access levels
│       │   ├── audit/           # Audit log viewer & export
│       │   ├── auth/            # Login, SSO, token management
│       │   ├── dashboard/       # Main dashboard
│       │   ├── roles/           # Role management & permission assignment
│       │   ├── settings/        # Settings, AD config, buildings, card templates
│       │   ├── users/           # User management
│       │   ├── visits/          # Visits, calendar, on-site, blacklist, parking
│       │   └── workstations/    # Workstation management & device status
│       ├── layout/            # Sidebar, header, layout shell
│       └── shared/            # Pipes, directives, shared components
├── migdal-printer-service/    # .NET 9 printer agent (Windows service)
├── migdal-scanner-service/    # .NET scanner agent (Windows service)
├── docs/                      # Architecture & design documentation
└── README.md
```

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9
- Microsoft SQL Server (local or Docker)
- Angular CLI (`npm install -g @angular/cli`)
- NestJS CLI (`npm install -g @nestjs/cli`)

### Backend

```bash
cd migdal-backend
cp .env.example .env        # Configure your environment
npm install
npm run migration:run        # Run database migrations
npm run seed                 # Seed initial data
npm run start:dev            # Start in development mode
```

API available at: `http://localhost:3000/api`
Swagger docs at: `http://localhost:3000/api/docs`

### Frontend

```bash
cd migdal-frontend
npm install
ng serve                     # Start in development mode
```

App available at: `http://localhost:4200`

### Default Admin Credentials (after seeding)

```
Username: admin
Password: Admin@123456
```

> **Change these immediately in production.**

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System architecture overview |
| [Backend Structure](docs/backend-structure.md) | NestJS project structure & modules |
| [Frontend Structure](docs/frontend-structure.md) | Angular project structure & components |
| [Database Design](docs/database-design.md) | Schema, tables, relationships |
| [Auth Flow](docs/auth-flow.md) | Authentication & authorization (JWT + Entra ID) |
| [WebSocket Events](docs/websocket-events.md) | Real-time event contracts (users + agents) |
| [Permissions Model](docs/permissions-model.md) | RBAC & 47 permission keys |
| [Integrations](docs/integrations.md) | Inbound M2M integration platform |
| [API Validation Workflow](docs/api-validation-workflow.md) | DTO validation & error handling |
| [API Test Strategy](docs/api-test-strategy.md) | Testing approach & conventions |
| [Development Rules](docs/development-rules.md) | Coding conventions & guidelines |
| [Roadmap](docs/roadmap.md) | Development phases & milestones |

## License

Proprietary — Migdal © 2026
