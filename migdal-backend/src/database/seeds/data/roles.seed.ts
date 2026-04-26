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
    {
        name: 'עובד מגדל',
        description: 'קבוצת הרשאה ברירת מחדל עבור עובדי מגדל',
        isSystem: false,
        permissions: [
            PermissionKey.VisitsCreate,
            PermissionKey.VisitsRead,
            PermissionKey.VisitsUpdate,
            PermissionKey.VisitsDelete,
            PermissionKey.AccessControlImport,
        ],
    },
    {
        name: 'מנהלים בכירים ומזכירות',
        description: 'קבוצת הרשאה ברירת מחדל עבור הנהלה בכירה ומזכירות',
        isSystem: false,
        permissions: [
            PermissionKey.VisitsCreate,
            PermissionKey.VisitsRead,
            PermissionKey.VisitsUpdate,
            PermissionKey.VisitsDelete,
            PermissionKey.ParkingRequest,
            PermissionKey.AccessControlImport,
        ],
    },
    {
        name: 'מרכז הדרכות',
        description: 'קבוצת הרשאה ברירת מחדל עבור מרכז הדרכות',
        isSystem: false,
        permissions: [
            PermissionKey.VisitsCreate,
            PermissionKey.VisitsRead,
            PermissionKey.VisitsDelete,
            PermissionKey.ParkingRequest,
            PermissionKey.AccessControlImport,
        ],
    },
    {
        name: 'מוקד ביטחון',
        description: 'קבוצת הרשאה ברירת מחדל עבור מוקד ביטחון',
        isSystem: false,
        permissions: [
            PermissionKey.VisitsCreate,
            PermissionKey.VisitsRead,
            PermissionKey.VisitsUpdate,
            PermissionKey.VisitsDelete,
            PermissionKey.ParkingRequest,
            PermissionKey.ParkingApprove,
            PermissionKey.AccessControlImport,
        ],
    },
    {
        name: 'דלפקים',
        description: 'קבוצת הרשאה ברירת מחדל עבור דלפקים',
        isSystem: false,
        permissions: [
            PermissionKey.VisitsCreate,
            PermissionKey.VisitsRead,
            PermissionKey.VisitsUpdate,
            PermissionKey.VisitsDelete,
            PermissionKey.ParkingRequest,
        ],
    },
    {
        name: 'קב"ט',
        description: 'קבוצת הרשאה ברירת מחדל עבור קב"ט',
        isSystem: false,
        permissions: [
            PermissionKey.VisitsCreate,
            PermissionKey.VisitsRead,
            PermissionKey.VisitsUpdate,
            PermissionKey.VisitsDelete,
            PermissionKey.ParkingApprove,
            PermissionKey.AccessControlImport,
        ],
    },
];
