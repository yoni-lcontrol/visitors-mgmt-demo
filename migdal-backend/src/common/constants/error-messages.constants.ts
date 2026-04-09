export const ErrorMessages = {
    // Auth
    INVALID_CREDENTIALS: 'Invalid email or password',
    TOKEN_EXPIRED: 'Token has expired',
    TOKEN_INVALID: 'Invalid token',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'You do not have permission to perform this action',
    REFRESH_TOKEN_INVALID: 'Invalid or expired refresh token',

    // Users
    USER_NOT_FOUND: 'User not found',
    USER_EMAIL_EXISTS: 'A user with this email already exists',
    USER_INACTIVE: 'Your account has been deactivated. Please contact your system administrator to restore access.',

    // Roles
    ROLE_NOT_FOUND: 'Role not found',
    ROLE_NAME_EXISTS: 'A role with this name already exists',
    ROLE_SYSTEM_PROTECTED: 'System roles cannot be modified',

    // Permissions
    PERMISSION_NOT_FOUND: 'Permission not found',

    // Access Control
    CONTROLLER_NOT_FOUND: 'Controller not found',
    DOOR_NOT_FOUND: 'Door not found',
    EXTENSION_NOT_FOUND: 'Extension not found',
    DOOR_IO_NOT_FOUND: 'Door IO not found',
    EXTENSION_IO_NOT_FOUND: 'Extension IO not found',
    IMPORT_FAILED: 'Import operation failed',

    // Visitors
    VISITOR_NOT_FOUND: 'Visitor not found',

    // Settings
    SETTING_NOT_FOUND: 'Setting not found',
    SETTING_KEY_EXISTS: 'A setting with this key already exists',

    // General
    ENTITY_NOT_FOUND: 'Entity not found',
    VALIDATION_FAILED: 'Validation failed',
    INTERNAL_ERROR: 'An internal error occurred',
} as const;
