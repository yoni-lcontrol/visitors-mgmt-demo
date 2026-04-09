import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ldapts';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';

export interface AdUserEntry {
    externalId: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    title: string | null;
    idNumber: string | null;
}

export class AdConnectionException extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
    }
}

@Injectable()
export class AdSyncAdapterService {
    private readonly logger = new Logger(AdSyncAdapterService.name);

    validateConfig(config: AdConfiguration): string[] {
        const errors: string[] = [];
        if (!config.domain) errors.push('domain is required');
        if (!config.ldapUrl) errors.push('ldapUrl is required');
        if (!config.username) errors.push('username is required');
        if (!config.password) errors.push('password is required');
        return errors;
    }

    async fetchUsers(config: AdConfiguration): Promise<AdUserEntry[]> {
        const errors = this.validateConfig(config);
        if (errors.length) {
            throw new AdConnectionException(
                'AD_INVALID_CONFIG',
                `Invalid AD configuration "${config.name}": ${errors.join(', ')}`,
            );
        }

        const url = this.buildLdapUrl(config);
        const client = new Client({
            url,
            tlsOptions: config.useSsl ? { rejectUnauthorized: false } : undefined,
            connectTimeout: 15_000,
        });

        try {
            const bindDn = this.buildBindDn(config);
            this.logger.log(`Connecting to AD "${config.name}" at ${this.maskUrl(url)}`);
            await client.bind(bindDn, config.password);

            const baseDn = config.baseDn ?? `DC=${config.domain.split('.').join(',DC=')}`;
            const filter = '(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))';

            const { searchEntries } = await client.search(baseDn, {
                scope: 'sub',
                filter,
                attributes: [
                    'sAMAccountName',
                    'userPrincipalName',
                    'givenName',
                    'sn',
                    'mail',
                    'telephoneNumber',
                    'mobile',
                    'department',
                    'title',
                    'employeeID',
                ],
                paged: { pageSize: 500 },
                timeLimit: 120,
            });

            const users = searchEntries
                .filter(entry => this.getAttr(entry, 'sAMAccountName'))
                .map(entry => this.mapEntry(entry));

            this.logger.log(`Fetched ${users.length} users from AD "${config.name}"`);
            return users;
        } catch (err) {
            if (err instanceof AdConnectionException) throw err;
            const msg = (err as Error).message ?? '';
            if (/invalid credentials|authentication|bind/i.test(msg)) {
                throw new AdConnectionException('AD_AUTH_FAILED', `AD authentication failed for "${config.name}"`);
            }
            if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|connect/i.test(msg)) {
                throw new AdConnectionException('AD_CONNECTION_FAILED', `Unable to connect to AD "${config.name}"`);
            }
            if (/timeout|timelimit/i.test(msg)) {
                throw new AdConnectionException('AD_TIMEOUT', `AD search timed out for "${config.name}"`);
            }
            throw new AdConnectionException('AD_FETCH_FAILED', `AD fetch failed for "${config.name}": ${msg}`);
        } finally {
            try { await client.unbind(); } catch { /* ignore unbind errors */ }
        }
    }

    mapEntry(entry: Record<string, unknown>): AdUserEntry {
        const samAccount = this.getAttr(entry, 'sAMAccountName');
        return {
            externalId: samAccount,
            username: samAccount,
            firstName: this.getAttr(entry, 'givenName') || samAccount,
            lastName: this.getAttr(entry, 'sn') || '',
            email: this.getAttr(entry, 'mail') || null,
            phone: this.getAttr(entry, 'telephoneNumber') || this.getAttr(entry, 'mobile') || null,
            department: this.getAttr(entry, 'department') || null,
            title: this.getAttr(entry, 'title') || null,
            idNumber: this.getAttr(entry, 'employeeID') || null,
        };
    }

    private buildLdapUrl(config: AdConfiguration): string {
        if (config.useSsl) {
            const rawUrl = config.ldapUrl.startsWith('ldap')
                ? config.ldapUrl
                : `ldap://${config.ldapUrl}`;
            const hostname = new URL(rawUrl).hostname;
            return `ldaps://${hostname}:${config.port}`;
        }
        return config.ldapUrl.includes('://')
            ? config.ldapUrl
            : `ldap://${config.ldapUrl}:${config.port}`;
    }

    private buildBindDn(config: AdConfiguration): string {
        if (config.username.includes('@') || config.username.includes('\\')) {
            return config.username;
        }
        return `${config.username}@${config.domain}`;
    }

    private maskUrl(url: string): string {
        try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
        } catch {
            return '***';
        }
    }

    getAttr(entry: Record<string, unknown>, attr: string): string {
        const val = entry[attr];
        if (!val) return '';
        if (Array.isArray(val)) return String(val[0] ?? '');
        return String(val);
    }
}
