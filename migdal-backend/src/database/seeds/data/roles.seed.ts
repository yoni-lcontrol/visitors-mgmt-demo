import { PermissionKey } from '../../../common/enums/permission-key.enum';

export interface RoleSeedData {
    name: string;
    description: string;
    isSystem: boolean;
    permissions: PermissionKey[];
}

export const rolesSeed: RoleSeedData[] = [
    {
        name: 'Admin',
        description: 'Full system administrator with all permissions',
        isSystem: true,
        permissions: Object.values(PermissionKey),
    },
    {
        name: 'Operator',
        description: 'Day-to-day operational access',
        isSystem: true,
        permissions: [
            PermissionKey.UsersRead,
            PermissionKey.RolesRead,
            PermissionKey.AccessControlCreate,
            PermissionKey.AccessControlRead,
            PermissionKey.AccessControlUpdate,
            PermissionKey.AccessControlImport,
            PermissionKey.AccessControlSync,
            PermissionKey.VisitsCreate,
            PermissionKey.VisitsRead,
            PermissionKey.VisitsUpdate,
            PermissionKey.VisitsDelete,
            PermissionKey.VisitsPrintCard,
            PermissionKey.BlacklistRead,
            PermissionKey.BlacklistCreate,
            PermissionKey.BlacklistUpdate,
            PermissionKey.BlacklistDelete,
            PermissionKey.ParkingRequest,
            PermissionKey.ParkingAutoApprove,
            PermissionKey.DevicesRead,
            PermissionKey.ScannerExecute,
            PermissionKey.SettingsRead,
            PermissionKey.WorkstationsRead,
        ],
    },
    {
        name: 'Viewer',
        description: 'Read-only access to the system',
        isSystem: true,
        permissions: [
            PermissionKey.UsersRead,
            PermissionKey.RolesRead,
            PermissionKey.AccessControlRead,
            PermissionKey.VisitsRead,
            PermissionKey.BlacklistRead,
            PermissionKey.DevicesRead,
            PermissionKey.SettingsRead,
            PermissionKey.AuditRead,
            PermissionKey.WorkstationsRead,
        ],
    },
];
