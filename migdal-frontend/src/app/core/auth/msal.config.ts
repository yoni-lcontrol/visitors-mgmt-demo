import { IPublicClientApplication, PublicClientApplication, LogLevel, BrowserCacheLocation } from '@azure/msal-browser';
import { environment } from '../../../environments/environment';

export function getEntraAuthority(): string {
    if (environment.entra.authority) {
        return environment.entra.authority;
    }
    return `https://login.microsoftonline.com/${environment.entra.tenantId}`;
}

export function getBackendApiScopes(): string[] {
    if (!environment.entra.apiAudience) {
        return ['openid', 'profile', 'email'];
    }

    return [
        'openid',
        'profile',
        'email',
        `${environment.entra.apiAudience}/access_as_user`,
    ];
}

export function createMsalInstance(): IPublicClientApplication {
    return new PublicClientApplication({
        auth: {
            clientId: environment.entra.clientId,
            authority: getEntraAuthority(),
            redirectUri: environment.entra.redirectUri,
            postLogoutRedirectUri: environment.entra.postLogoutRedirectUri || environment.entra.redirectUri,
        },
        cache: {
            cacheLocation: BrowserCacheLocation.SessionStorage,
        },
        system: {
            loggerOptions: {
                logLevel: environment.production ? LogLevel.Error : LogLevel.Warning,
                piiLoggingEnabled: false,
            },
        },
    });
}

export function isEntraConfigured(): boolean {
    return !!(environment.entra.clientId && environment.entra.tenantId);
}
