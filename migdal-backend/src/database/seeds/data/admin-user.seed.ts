export interface AdminUserSeedData {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    roleName: string;
}

export const adminUserSeed: AdminUserSeedData = {
    username: 'admin',
    password: 'Admin@123456',
    firstName: 'System',
    lastName: 'Administrator',
    roleName: 'Admin',
};
