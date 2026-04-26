function normalizeRoles(userRoles: string[] | undefined): string[] {
    return (userRoles ?? []).map((role) => role.trim().toLowerCase());
}

function hasAnyRoleFragment(userRoles: string[] | undefined, fragments: string[]): boolean {
    const normalized = normalizeRoles(userRoles);
    return normalized.some((role) => fragments.some((fragment) => role.includes(fragment)));
}

export function canAccessAllVisitors(userRoles: string[] | undefined): boolean {
    return hasAnyRoleFragment(userRoles, ['דלפק', 'ביטחון', 'קב"ט', 'קבט', 'admin', 'operator']);
}

export function shouldRestrictVisitorsToOwn(userRoles: string[] | undefined): boolean {
    if (canAccessAllVisitors(userRoles)) {
        return false;
    }

    return hasAnyRoleFragment(userRoles, ['עובד מגדל', 'מזכירות', 'מנהלי תחום', 'מרכז הדרכות']);
}