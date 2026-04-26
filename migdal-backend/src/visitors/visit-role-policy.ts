export const VisitRoleName = {
    TowerEmployee: 'עובד מגדל',
    TrainingCenter: 'מרכז הדרכות',
    SecurityDesk: 'מוקד ביטחון',
    ReceptionDesk: 'דלפקים',
    Kabat: 'קב"ט',
} as const;

interface CreatorScopeRequirements {
    includeCurrentUser: boolean;
    includeTrainingCenterUsers: boolean;
}

function normalizeRoles(userRoles: string[] | undefined): Set<string> {
    return new Set((userRoles ?? []).map((role) => role.trim().toLowerCase()));
}

function hasRole(userRoles: string[] | undefined, roleName: string): boolean {
    return normalizeRoles(userRoles).has(roleName.trim().toLowerCase());
}

export function isEscortRequiredForVisit(userRoles: string[] | undefined, isSelfRequester: boolean): boolean {
    if (hasRole(userRoles, VisitRoleName.TowerEmployee)) {
        return true;
    }

    if (hasRole(userRoles, VisitRoleName.SecurityDesk) && isSelfRequester) {
        return true;
    }

    return false;
}

export function isOnBehalfOnlyRole(userRoles: string[] | undefined): boolean {
    return hasRole(userRoles, VisitRoleName.ReceptionDesk) || hasRole(userRoles, VisitRoleName.Kabat);
}

export function resolveCreatorScopeRequirements(userRoles: string[] | undefined): CreatorScopeRequirements | null {
    const includeCurrentUser = hasRole(userRoles, VisitRoleName.TowerEmployee);
    const includeTrainingCenterUsers = hasRole(userRoles, VisitRoleName.TrainingCenter);

    if (!includeCurrentUser && !includeTrainingCenterUsers) {
        return null;
    }

    return {
        includeCurrentUser,
        includeTrainingCenterUsers,
    };
}

export function shouldRestrictDeletionToOwnVisits(userRoles: string[] | undefined): boolean {
    return hasRole(userRoles, VisitRoleName.ReceptionDesk);
}
