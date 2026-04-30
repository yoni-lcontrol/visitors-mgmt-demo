import { PermissionKey } from '../common/enums/permission-key.enum';

interface CreatorScopeRequirements {
    includeCurrentUser: boolean;
    includeTrainingCenterUsers: boolean;
}

function hasPermission(userPermissions: string[] | undefined, permission: PermissionKey): boolean {
    return (userPermissions ?? []).includes(permission);
}

export function isEscortRequiredForVisit(userPermissions: string[] | undefined, isSelfRequester: boolean): boolean {
    if (hasPermission(userPermissions, PermissionKey.VisitsEscortRequired)) {
        return true;
    }

    if (hasPermission(userPermissions, PermissionKey.VisitsEscortRequiredSelfRequester) && isSelfRequester) {
        return true;
    }

    return false;
}

export function isOnBehalfOnlyRole(userPermissions: string[] | undefined): boolean {
    return hasPermission(userPermissions, PermissionKey.VisitsOnBehalfOnly);
}

export function resolveCreatorScopeRequirements(userPermissions: string[] | undefined): CreatorScopeRequirements | null {
    const includeCurrentUser = hasPermission(userPermissions, PermissionKey.VisitsScopeOwn);
    const includeTrainingCenterUsers = hasPermission(userPermissions, PermissionKey.VisitsScopeTrainingCenter);

    if (!includeCurrentUser && !includeTrainingCenterUsers) {
        return null;
    }

    return {
        includeCurrentUser,
        includeTrainingCenterUsers,
    };
}

export function shouldRestrictDeletionToOwnVisits(userPermissions: string[] | undefined): boolean {
    return hasPermission(userPermissions, PermissionKey.VisitsDeleteOwnOnly);
}
