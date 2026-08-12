export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    user: AuthUser;
}

export interface AuthUser {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    sector: { id: string; name: string } | null;
    roles: string[];
    permissions: string[];
}

export interface KerberosClientConfig {
    enabled: boolean;
}
