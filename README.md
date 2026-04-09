# Migdal Management Platform

A web-based management platform built with **Angular** (frontend), **NestJS** (backend), and **Microsoft SQL Server** (database).

## Overview

Migdal is an enterprise-grade platform for managing access control systems, visitor management, and system administration with robust authentication and authorization.

### Key Features

- **JWT Authentication** with access + refresh tokens
- **Role-Based Access Control (RBAC)** with granular permissions
- **Access Control Management** — controllers, doors, extensions, IOs
- **Visitor Management** — invitations, tracking, host assignment
- **System Settings** — grouped, typed, admin-editable
- **Realtime Updates** via WebSocket (socket.io)
- **Swagger/OpenAPI** documentation
- **Structured Logging** and audit trail

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular, TypeScript, PrimeNG |
| Backend | NestJS, TypeScript, TypeORM |
| Database | Microsoft SQL Server |
| Auth | JWT (access + refresh tokens), bcrypt |
| Realtime | socket.io via @nestjs/websockets |
| API Docs | Swagger / OpenAPI |
| Logging | Pino (nestjs-pino) |

## Project Structure

```
migdal_v2/
├── migdal-backend/   # NestJS API server (separate project)
├── migdal-frontend/  # Angular web application (separate project)
├── docs/             # Architecture and design documentation
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
Email:    admin@migdal.local
Password: Admin@123456
```

> **Change these immediately in production.**

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System architecture overview |
| [Backend Structure](docs/backend-structure.md) | NestJS project structure |
| [Frontend Structure](docs/frontend-structure.md) | Angular project structure |
| [Database Design](docs/database-design.md) | Schema, tables, relationships |
| [Auth Flow](docs/auth-flow.md) | Authentication & authorization |
| [WebSocket Events](docs/websocket-events.md) | Realtime event contracts |
| [Permissions Model](docs/permissions-model.md) | RBAC & permission strategy |
| [Development Rules](docs/development-rules.md) | Coding conventions & guidelines |
| [Roadmap](docs/roadmap.md) | Development phases & milestones |

## License

Proprietary — Migdal © 2026
