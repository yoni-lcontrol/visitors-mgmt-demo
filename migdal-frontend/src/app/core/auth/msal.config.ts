import { IPublicClientApplication, PublicClientApplication, LogLevel, BrowserCacheLocation } from '@azure/msal-browser';
import { environment } from '../../../environments/environment';

export function createMsalInstance(): IPublicClientApplication {
    return new PublicClientApplication({
        auth: {
            clientId: environment.entra.clientId,
            authority: `https://login.microsoftonline.com/${environment.entra.tenantId}`,
            redirectUri: environment.entra.redirectUri,
            postLogoutRedirectUri: environment.entra.redirectUri,
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
