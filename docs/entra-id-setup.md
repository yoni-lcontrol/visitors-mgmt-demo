# Microsoft Entra ID Setup

This document describes the manual Microsoft Entra ID configuration required for Migdal dev/test environments.

## Goals

- Entra ID is used for authentication only.
- Migdal backend remains the source of truth for authorization (roles/permissions).
- Frontend obtains an Entra access token for the backend API scope.
- Backend validates the Entra access token and then issues local JWT tokens.

## App Registrations

Create two Entra app registrations.

1. Frontend SPA app registration
2. Backend API app registration

### 1) Backend/API app registration

1. Create app registration (for example: `migdal-backend-dev`).
2. Record Application (client) ID and Directory (tenant) ID.
3. In Expose an API:
   - Set Application ID URI (for example `api://<backend-client-id>`).
   - Add scope: `access_as_user`.
   - Scope display name: `Access Migdal backend as user`.
   - Admin/user consent text as appropriate for your tenant.
4. In Token configuration (optional):
   - Add optional claims if needed (`email`, `preferred_username`, `name`).

### 2) Frontend SPA app registration

1. Create app registration (for example: `migdal-frontend-dev`).
2. In Authentication:
   - Add platform: Single-page application.
   - Redirect URI (dev): `http://localhost:4200`.
   - Logout URL: `http://localhost:4200`.
3. In API permissions:
   - Add delegated permission to the backend API scope: `access_as_user`.
   - Grant admin consent for the tenant if required.

## Required Environment Variables

### Backend (`migdal-backend/.env.development`)

- `ENTRA_TENANT_ID=<tenant-guid>`
- `ENTRA_CLIENT_ID=<frontend-spa-client-id>`
- `ENTRA_AUTHORITY=https://login.microsoftonline.com/<tenant-guid>`
- `ENTRA_REDIRECT_URI=http://localhost:4200`
- `ENTRA_POST_LOGOUT_REDIRECT_URI=http://localhost:4200`
- `ENTRA_API_AUDIENCE=api://<backend-api-client-id>`
- `ENTRA_UNKNOWN_USER_MODE=deny`
- `ENTRA_AUTO_PROVISION=false`
- `ENTRA_DEFAULT_ROLE=Viewer`

Notes:
- `ENTRA_UNKNOWN_USER_MODE` options:
  - `deny`: reject unknown users.
  - `pending`: create disabled pending user and reject login.
  - `autoProvision`: create local user with `ENTRA_DEFAULT_ROLE`.
- `APP_ID_URI` may be used as a fallback to `ENTRA_API_AUDIENCE`.

### Frontend (`migdal-frontend/src/environments/environment.ts`)

- `entra.clientId` = frontend SPA app client ID
- `entra.tenantId` = tenant ID
- `entra.authority` = `https://login.microsoftonline.com/<tenant-guid>`
- `entra.redirectUri` = SPA redirect URI
- `entra.postLogoutRedirectUri` = SPA logout redirect URI
- `entra.apiAudience` = backend API application ID URI (for example `api://<backend-client-id>`)

## Token and Identity Mapping

After backend validation, claims are mapped using:

- `oid` -> `externalAuthId`
- `tid` -> `externalTenantId`
- `preferred_username` / `email` -> `email` fallback mapping
- `name` -> `displayName`

Backend user resolution order:

1. Existing user by (`externalAuthId`, `externalTenantId`)
2. Existing user by email, then link Entra identity
3. Unknown-user mode handling (`deny` / `pending` / `autoProvision`)

## Dev/Test Redirect URIs

At minimum, configure:

- `http://localhost:4200`

If using alternate ports/hosts in test environments, add each exact URI to the SPA app registration.

## Security Notes

- Do not hardcode secrets or tenant values in code.
- Backend must validate signature, issuer, audience, tenant, and expiry.
- Frontend token claims are not trusted for authorization.
- Authorization checks continue to rely on Migdal local roles and permissions.
