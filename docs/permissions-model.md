# Permissions Model

## Overview

Migdal uses Role-Based Access Control (RBAC) with granular, per-action permissions.

## Hierarchy

```
User
 Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ has many Roles (via UserRoles junction)
       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ each Role has many Permissions (via RolePermissions junction)
```

**Effective permissions** for a user = union of all permissions from all assigned roles.

## Permission Key Format

```
{module}.{action}
```

| Module | Actions | Permission Keys |
|--------|---------|-----------------|
| `users` | create, read, update, sync | `users.create`, `users.read`, `users.update`, `users.sync` |
| `roles` | create, read, update, delete | `roles.create`, `roles.read`, `roles.update`, `roles.delete` |
| `permissions` | read | `permissions.read` |
| `access-control` | create, read, update, delete, import, sync | `access-control.create`, `access-control.read`, `access-control.update`, `access-control.delete`, `access-control.import`, `access-control.sync` |
| `visits` | create, read, update, delete, print-card, check-in-code.send, check-in-code.regenerate, on-behalf-only, escort.required, escort.required.self-requester, scope.own, scope.all, scope.training-center, delete.own-only | `visits.create`, `visits.read`, `visits.update`, `visits.delete`, `visits.print-card`, `visits.check-in-code.send`, `visits.check-in-code.regenerate`, `visits.on-behalf-only`, `visits.escort.required`, `visits.escort.required.self-requester`, `visits.scope.own`, `visits.scope.all`, `visits.scope.training-center`, `visits.delete.own-only` |
| `visitors` | create, read, update, delete, export, import, scope.own | `visitors.create`, `visitors.read`, `visitors.update`, `visitors.delete`, `visitors.export`, `visitors.import`, `visitors.scope.own` |
| `settings` | read, update | `settings.read`, `settings.update` |
| `settings.permanent-escorts` | read, manage | `settings.permanent-escorts.read`, `settings.permanent-escorts.manage` |
| `settings.card-templates` | create, read, update, delete | `settings.card-templates.create`, `settings.card-templates.read`, `settings.card-templates.update`, `settings.card-templates.delete` |
| `audit` | read, export | `audit.read`, `audit.export` |
| `devices` | read, manage | `devices.read`, `devices.manage` |
| `scanner` | execute | `scanner.execute` |
| `workstations` | create, read, update, delete, assign-users, assign-roles, enroll-agents | `workstations.create`, `workstations.read`, `workstations.update`, `workstations.delete`, `workstations.assign-users`, `workstations.assign-roles`, `workstations.enroll-agents` |
| `buildings` | create, read, update | `buildings.create`, `buildings.read`, `buildings.update` |
| `vehicle-models` | view, create, update, delete, export | `vehicle-models.view`, `vehicle-models.create`, `vehicle-models.update`, `vehicle-models.delete`, `vehicle-models.export` |
| `blacklist` | create, read, update, delete, check | `blacklist.create`, `blacklist.read`, `blacklist.update`, `blacklist.delete`, `blacklist.check` |
| `parking` | request, auto-approve, approve | `parking.request`, `parking.auto-approve`, `parking.approve` |
| `domains` | create, read, update, delete | `domains.create`, `domains.read`, `domains.update`, `domains.delete` |

**Total: 76 permissions**

## Default Roles

### Admin (System Role)

Full access to everything. Cannot be deleted or modified.

```
All permissions
```

### Operator (System Role)

Day-to-day operational access without administrative capabilities.

```
users.read
roles.read
permissions.read
access-control.create, access-control.read, access-control.update, access-control.import
visits.create, visits.read, visits.update, visits.delete
visits.print-card
visitors.create, visitors.read, visitors.update, visitors.delete, visitors.export, visitors.import
blacklist.create, blacklist.read, blacklist.update, blacklist.delete, blacklist.check
parking.request, parking.auto-approve
devices.read
scanner.execute
settings.read
settings.permanent-escorts.read
buildings.create, buildings.read, buildings.update
```

### Viewer (System Role)

Read-only access across the system.

```
users.read
roles.read
permissions.read
access-control.read
visits.read
visitors.read
blacklist.read, blacklist.check
devices.read
settings.permanent-escorts.read
settings.read
buildings.read
```

### Custom Roles

Admins can create additional roles with any combination of permissions.

## Permission Resolution Algorithm

```
function getEffectivePermissions(user: User): string[] {
  const permissions = new Set<string>();
  for (const role of user.roles) {
    for (const permission of role.permissions) {
      permissions.add(permission.key);
    }
  }
  return Array.from(permissions);
}
```

Permissions are calculated at login time and embedded in the JWT access token. They are refreshed when:
- User logs in
- Access token is refreshed (via refresh token endpoint)

## Backend Enforcement

### Guard Flow

```
Request
  Ã¢â€â€š
  Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ JwtAuthGuard (global)
  Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Validates JWT Ã¢â€ â€™ populates request.user
  Ã¢â€â€š
  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ PermissionsGuard (global)
      Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Reads @RequirePermissions metadata
      Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Checks request.user.permissions
      Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ 403 Forbidden if missing
```

### Decorator

```typescript
@RequirePermissions('users.create', 'users.read')  // ALL listed permissions required
```

### Multiple Permissions

When multiple permissions are passed to `@RequirePermissions`, **all** are required (AND logic).
For OR logic, create separate endpoints or use a custom `@RequireAnyPermission` decorator.

## Frontend Enforcement

### Route Guard

```typescript
{
  path: 'users',
  loadChildren: ...,
  canActivate: [permissionGuard],
  data: { permission: 'users.read' }
}
```

### Structural Directive

```html
<button *hasPermission="'users.create'">Create User</button>
```

### Programmatic Check

```typescript
if (this.permissionService.hasPermission('users.update')) {
  // show edit button
}
```

### Sidebar Navigation

Menu items are filtered based on user permissions. The sidebar component checks permissions before rendering each nav item. The Visitors Management submenu can render for visit workflows, the standalone visitor directory, or both, depending on the user's effective permissions.

## Implementation Guidelines

Authorization must be implemented by permission keys only.

- Backend route access: use `@RequirePermissions(...)` on controllers.
- Backend business/data scope: pass `@CurrentUser('permissions')` into services and evaluate policy from `request.user.permissions`.
- Frontend routes: use `permissionGuard` with route `data.permission`.
- Frontend UI controls: use `*hasPermission` and `PermissionService.hasPermission(...)`.
- Never use role name/code/ID checks (for example, `roles.includes('Admin')`) for authorization decisions.

### Backend Example

```typescript
@Get('visitors')
@RequirePermissions(PermissionKey.VisitorsRead)
findAll(
  @Query() query: PaginationQueryDto,
  @CurrentUser('sub') userId: string,
  @CurrentUser('permissions') permissions: string[],
) {
  return this.visitorsService.findAll(query, userId, permissions);
}
```

### Frontend Example

```typescript
canDeleteVisit(visit: Visit): boolean {
  if (!this.permissionService.hasPermission('visits.delete')) return false;
  if (!this.permissionService.hasPermission('visits.delete.own-only')) return true;
  return visit.createdByUserId === this.permissionService.getCurrentUserId();
}
```

## Important Design Decisions

1. **Permissions in JWT**: Avoids DB lookup on every request. Tradeoff: changes take effect on next token refresh (max 15 min).

2. **System roles are protected**: Admin, Operator, Viewer cannot be deleted. Their permissions can be viewed but not modified.

3. **No hierarchical roles**: Roles do not inherit from each other. A user's permissions are the flat union of all role permissions. This keeps the model simple and predictable.

4. **Permissions are code-defined**: Permissions are seeded from a code-defined list. They cannot be created/deleted from the UI Ã¢â‚¬â€ only assigned to roles. This prevents invalid/orphan permissions.

5. **Frontend enforcement is UX-only**: Frontend guards and directives hide UI elements, but the backend is the true enforcer. A user bypassing the UI will still be blocked by backend guards.

## Visitor Directory Scope Rules

The Visitors Directory is controlled only by permissions from `request.user.permissions`:

- **Own-only scope**: users with `visitors.scope.own` can see and edit only visitors that belong to them (created by them, or linked to visits they created/requested).
- **Full scope**: users without `visitors.scope.own` can access all visitors (subject to endpoint permission guards).

Scope enforcement is backend-side and applies consistently to list, search, export, read-by-id, update, and delete endpoints under `/visitors`.

## Visit Policy Permissions

Visit workflow constraints are also permission-driven (not role-name-driven):

- `visits.on-behalf-only`: requester must be "on behalf of someone else" (self requester is blocked).
- `visits.escort.required`: escort is required for all new visits.
- `visits.escort.required.self-requester`: escort is required only when requester is self.
- `visits.scope.own`: visit lists/details are scoped to visits created by the current user.
- `visits.scope.all`: overrides `scope.own` and `scope.training-center` — user can view all visits regardless of creator.
- `visits.scope.training-center`: visit lists/details are scoped to creators whose effective permissions include `visits.scope.training-center`.
- `visits.delete.own-only`: visit deletion is allowed only for visits created by the current user.

These permissions can be assigned/removed in Role Permissions management screens, and behavior changes without code changes.
