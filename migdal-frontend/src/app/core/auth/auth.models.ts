export interface LoginRequest {
    username: string;
    password: string;
}

export interface EntraLoginRequest {
    idToken: string;
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
    roles: string[];
    permissions: string[];
}

export interface EntraClientConfig {
    enabled: boolean;
    clientId: string | null;
    tenantId: string | null;
    redirectUri: string | null;
}
