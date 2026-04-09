import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify required permissions for a route handler.
 * All listed permissions are required (AND logic).
 * Usage: @RequirePermissions(PermissionKey.UsersCreate)
 */
export const RequirePermissions = (...permissions: string[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);
