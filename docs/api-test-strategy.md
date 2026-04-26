# API Test Strategy

## Purpose

This document defines how backend APIs must be tested in the NestJS application.

The goal is to ensure that every API change is validated consistently and that Copilot/AI assistants can follow a predictable testing process.

---

## Testing Layers

### 1. Unit Tests
Used for:
- service business logic
- permission resolution
- validators
- guards
- pure helper functions

Examples:
- `auth.service.spec.ts`
- `permissions.guard.spec.ts`
- `users.service.spec.ts`

### 2. Integration / Controller Tests
Used for:
- controller + service interaction
- DTO validation
- response shape
- auth/permission enforcement in HTTP layer

Examples:
- `auth.controller.spec.ts`
- `users.controller.spec.ts`

### 3. E2E API Tests
Used for:
- full request/response verification
- login flow
- refresh flow
- protected endpoints
- permission failures
- key CRUD and workflow scenarios

Examples:
- `auth.e2e-spec.ts`
- `users.e2e-spec.ts`
- `visitors.e2e-spec.ts`

---

## Minimum Coverage by Module

### Auth
Must test:
- login success
- login invalid credentials
- refresh success
- refresh invalid/expired token
- logout success
- logout with invalid token/session
- `GET /auth/me` authenticated
- `GET /auth/me` unauthenticated

### Users
Must test:
- create user success
- create user validation failure
- duplicate email rejection
- list users
- get user by id
- update user
- update AD-imported user should be rejected
- assign single role (`POST /users/:id/role`)
- assign multiple roles (`POST /users/:id/roles`)
- delete/deactivate user
- forbidden access without permission

### Roles / Permissions
Must test:
- list roles
- create role
- assign permissions to role
- protected system role restrictions
- forbidden access without permission

### Access Control
Must test:
- import controllers
- import doors
- import extensions
- import door IOs
- import extension IOs
- validation failures on invalid import payload
- relationship consistency
- duplicate import handling
- permission-protected import endpoint

### Visitors
Must test:
- create invitation
- invalid visit time rejection
- check-in
- check-out
- cancel invitation
- filter by status/date/host
- permission-protected actions

### Settings
Must test:
- list grouped settings
- update setting
- invalid setting update
- restricted admin-only access

---

## Required Assertions for Each API Test

For relevant endpoints, validate:

- HTTP status code
- response body shape
- success flag
- main returned fields
- validation error shape
- authentication behavior
- authorization behavior
- expected persistence behavior where applicable

---

## Standard Test Data Approach

- Use factories/builders for DTO and entity creation
- Avoid large inline objects repeated across tests
- Use dedicated seed helpers for roles, permissions, and users
- Keep tests isolated and deterministic
- Prefer explicit setup over hidden shared side effects

---

## Test Naming Convention

Use descriptive names:

```text
should login successfully with valid credentials
should return 401 for invalid password
should return 403 when user lacks users.create permission
should reject visitor invitation when endTime is before startTime