export function extractPermissionsFromUser(
    user: {
        role: { permissions: { key: string }[] } | null;
        roles?: Array<{ permissions?: { key: string }[] }>;
    },
): string[] {
    const permSet = new Set<string>();

    const roles = user.roles && user.roles.length > 0
        ? user.roles
        : (user.role ? [user.role] : []);

    for (const role of roles) {
        for (const perm of role.permissions ?? []) {
            permSet.add(perm.key);
        }
    }

    return [...permSet];
}
