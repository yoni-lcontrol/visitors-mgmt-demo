import { PermissionKey } from '../../../common/enums/permission-key.enum';

export interface PermissionSeedData {
    key: string;
    name: string;
    description: string;
    module: string;
    action: string;
}

export const permissionsSeed: PermissionSeedData[] = Object.values(
    PermissionKey,
).map((key) => {
    const [module, action] = key.split('.');
    const name = key
        .replace('.', ' ')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
        key,
        name,
        description: `Permission to ${action} ${module}`,
        module,
        action,
    };
});
