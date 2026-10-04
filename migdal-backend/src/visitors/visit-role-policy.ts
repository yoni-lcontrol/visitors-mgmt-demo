import { PermissionKey } from '../common/enums/permission-key.enum';

interface CreatorScopeRequirements {
    includeCurrentUser: boolean;
    includeTrainingCenterUsers: boolean;
    includeOwnDomain: boolean;
}

function hasPermission(userPermissions: string[] | undefined, permission: PermissionKey): boolean {
    return (userPermissions ?? []).includes(permission);
}

export function isEscortRequiredForVisit(
    userPermissions: string[] | undefined,
    isSelfRequester: boolean,
    requesterPermissions?: string[],
): boolean {
    if (hasPermission(userPermissions, PermissionKey.VisitsEscortRequired)) {
        return true;
    }

    if (hasPermission(userPermissions, PermissionKey.VisitsEscortRequiredSelfRequester) && isSelfRequester) {
        return true;
    }

    if (!isSelfRequester && hasPermission(requesterPermissions, PermissionKey.VisitsEscortRequiredAsRequester)) {
        return true;
    }

    return false;
}

export function isOnBehalfOnlyRole(userPermissions: string[] | undefined): boolean {
    return hasPermission(userPermissions, PermissionKey.VisitsOnBehalfOnly);
}

export function resolveCreatorScopeRequirements(userPermissions: string[] | undefined): CreatorScopeRequirements | null {
    if (hasPermission(userPermissions, PermissionKey.VisitsScopeAll)) {
        return null;
    }

    const includeCurrentUser = hasPermission(userPermissions, PermissionKey.VisitsScopeOwn);
    const includeTrainingCenterUsers = hasPermission(userPermissions, PermissionKey.VisitsScopeTrainingCenter);
    const includeOwnDomain = hasPermission(userPermissions, PermissionKey.VisitsScopeDomain);

    if (!includeCurrentUser && !includeTrainingCenterUsers && !includeOwnDomain) {
        return null;
    }

    return {
        includeCurrentUser,
        includeTrainingCenterUsers,
        includeOwnDomain,
    };
}

export function shouldRestrictDeletionToOwnVisits(userPermissions: string[] | undefined): boolean {
    return hasPermission(userPermissions, PermissionKey.VisitsDeleteOwnOnly);
}
