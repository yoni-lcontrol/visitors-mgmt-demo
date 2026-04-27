import { PermissionKey } from '../common/enums/permission-key.enum';

function hasPermission(userPermissions: string[] | undefined, permission: PermissionKey): boolean {
    return (userPermissions ?? []).includes(permission);
}

export function canAccessAllVisitors(userPermissions: string[] | undefined): boolean {
    return !hasPermission(userPermissions, PermissionKey.VisitorsScopeOwn);
}

export function shouldRestrictVisitorsToOwn(userPermissions: string[] | undefined): boolean {
    return hasPermission(userPermissions, PermissionKey.VisitorsScopeOwn);
}