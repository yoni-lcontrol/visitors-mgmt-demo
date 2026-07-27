import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User as SspiUser } from 'node-expose-sspi';

export type KerberosUnknownUserMode = 'deny' | 'pending' | 'autoProvision';

export interface KerberosConfig {
    enabled: boolean;
    unknownUserMode: KerberosUnknownUserMode;
    defaultRole: string;
}

export interface KerberosIdentity {
    username: string;
    domain: string;
    sid: string;
    displayName: string | null;
}

@Injectable()
export class KerberosService {
    constructor(private readonly configService: ConfigService) { }

    getConfig(): KerberosConfig {
        const enabled = this.configService.get<string>('KERBEROS_ENABLED', 'false') === 'true';
        const configuredUnknownUserMode = this.configService.get<string>('KERBEROS_UNKNOWN_USER_MODE', '').trim();

        let unknownUserMode: KerberosUnknownUserMode = 'deny';
        if (configuredUnknownUserMode === 'pending' || configuredUnknownUserMode === 'autoProvision' || configuredUnknownUserMode === 'deny') {
            unknownUserMode = configuredUnknownUserMode;
        }

        return {
            enabled,
            unknownUserMode,
            defaultRole: this.configService.get<string>('KERBEROS_DEFAULT_ROLE', 'Viewer'),
        };
    }

    isConfigured(): boolean {
        return this.getConfig().enabled;
    }

    /** Normalizes the SSPI-resolved Windows identity from `req.sso.user` into a stable shape. */
    extractIdentity(ssoUser?: SspiUser): KerberosIdentity | null {
        if (!ssoUser?.name || !ssoUser?.sid) {
            return null;
        }

        return {
            username: ssoUser.name,
            domain: ssoUser.domain ?? '',
            sid: ssoUser.sid,
            displayName: ssoUser.displayName ?? null,
        };
    }

    extractDisplayName(identity: KerberosIdentity): { firstName: string; lastName: string } {
        const fullName = (identity.displayName ?? '').trim();
        if (fullName) {
            const parts = fullName.split(' ');
            return {
                firstName: parts[0] || identity.username,
                lastName: parts.slice(1).join(' ') || 'User',
            };
        }
        return { firstName: identity.username, lastName: 'User' };
    }
}
