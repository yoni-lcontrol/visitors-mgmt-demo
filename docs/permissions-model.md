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
| `visits` | create, read, update, delete, print-card, check-in-code.send, check-in-code.regenerate | `visits.create`, `visits.read`, `visits.update`, `visits.delete`, `visits.print-card`, `visits.check-in-code.send`, `visits.check-in-code.regenerate` |
| `settings` | read, update | `settings.read`, `settings.update` |
| `settings.card-templates` | create, read, update, delete | `settings.card-templates.create`, `settings.card-templates.read`, `settings.card-templates.update`, `settings.card-templates.delete` |
| `audit` | read, export | `audit.read`, `audit.export` |
| `devices` | read, manage | `devices.read`, `devices.manage` |
| `scanner` | execute | `scanner.execute` |
| `workstations` | create, read, update, delete, assign-users, assign-roles, enroll-agents | `workstations.create`, `workstations.read`, `workstations.update`, `workstations.delete`, `workstations.assign-users`, `workstations.assign-roles`, `workstations.enroll-agents` |
| `buildings` | create, read, update | `buildings.create`, `buildings.read`, `buildings.update` |
| `blacklist` | create, read, update, delete, check | `blacklist.create`, `blacklist.read`, `blacklist.update`, `blacklist.delete`, `blacklist.check` |
| `parking` | request, auto-approve, approve | `parking.request`, `parking.auto-approve`, `parking.approve` |

**Total: 47 permissions**

## Default Roles

### Admin (System Role)

Full access to everything. Cannot be deleted or modified.

```
All 22 permissions
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
blacklist.create, blacklist.read, blacklist.update, blacklist.delete, blacklist.check
parking.request, parking.auto-approve
devices.read
scanner.execute
settings.read
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
blacklist.read, blacklist.check
devices.read
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

Menu items are filtered based on user permissions. The sidebar component checks permissions before rendering each nav item.

## Important Design Decisions

1. **Permissions in JWT**: Avoids DB lookup on every request. Tradeoff: changes take effect on next token refresh (max 15 min).

2. **System roles are protected**: Admin, Operator, Viewer cannot be deleted. Their permissions can be viewed but not modified.

3. **No hierarchical roles**: Roles do not inherit from each other. A user's permissions are the flat union of all role permissions. This keeps the model simple and predictable.

4. **Permissions are code-defined**: Permissions are seeded from a code-defined list. They cannot be created/deleted from the UI Ã¢â‚¬â€ only assigned to roles. This prevents invalid/orphan permissions.

5. **Frontend enforcement is UX-only**: Frontend guards and directives hide UI elements, but the backend is the true enforcer. A user bypassing the UI will still be blocked by backend guards.
