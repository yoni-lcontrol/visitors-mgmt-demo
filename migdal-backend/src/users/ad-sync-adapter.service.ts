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
    mobile: string | null;
    department: string | null;
    title: string | null;
    employeeId: string | null;
    idNumber: string | null;
    company: string | null;
    groupNames: string[];
    groupExternalIds: string[];
    isDisabled: boolean;
}

export class AdConnectionException extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
    }
}

export interface AdFetchUsersOptions {
    targetGroups?: string[];
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

    async fetchUsers(config: AdConfiguration, options?: AdFetchUsersOptions): Promise<AdUserEntry[]> {
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

            const baseDn = config.baseDn || `DC=${config.domain.split('.').join(',DC=')}`;

            const resolvedTargetGroups = this.normalizeGroupNames(options?.targetGroups);
            const searchFilter = resolvedTargetGroups.length
                ? await this.buildGroupScopedUserFilter(client, baseDn, resolvedTargetGroups)
                : '(&(objectClass=user)(objectCategory=person))';

            this.logger.log(`AD search baseDn="${baseDn}", filter="${searchFilter}"`);

            const { searchEntries } = await client.search(baseDn, {
                scope: 'sub',
                filter: searchFilter,
                attributes: this.getUserAttributes(),
                paged: { pageSize: 500 },
                timeLimit: 120,
            });

            const users = this.mapAndDeduplicateEntries(searchEntries, config.name);
            this.logger.log(
                `Fetched ${users.length} unique users from AD "${config.name}"` +
                (resolvedTargetGroups.length ? ` across ${resolvedTargetGroups.length} configured group(s)` : ''),
            );
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

    private getUserAttributes(): string[] {
        return [
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
            'idcard',
            'company',
            'memberOf',
            'userAccountControl',
        ];
    }

    private normalizeGroupNames(groups?: string[]): string[] {
        if (!groups?.length) {
            return [];
        }

        const unique = new Map<string, string>();
        for (const group of groups) {
            const normalized = String(group ?? '').trim();
            if (!normalized) {
                continue;
            }

            const dedupeKey = normalized.toLowerCase();
            if (!unique.has(dedupeKey)) {
                unique.set(dedupeKey, normalized);
            }
        }

        return [...unique.values()];
    }

    private async buildGroupScopedUserFilter(client: Client, baseDn: string, targetGroups: string[]): Promise<string> {
        const resolvedDns: string[] = [];
        const missingGroups: string[] = [];

        for (const group of targetGroups) {
            const groupDn = await this.resolveGroupDn(client, baseDn, group);
            if (groupDn) {
                resolvedDns.push(groupDn);
            } else {
                missingGroups.push(group);
            }
        }

        if (missingGroups.length) {
            this.logger.warn(`Configured AD group(s) not found: ${missingGroups.join(', ')}`);
        }

        if (!resolvedDns.length) {
            throw new AdConnectionException(
                'AD_GROUP_NOT_FOUND',
                `None of the configured AD groups were found: ${targetGroups.join(', ')}`,
            );
        }

        this.logger.log(`Resolved ${resolvedDns.length} group DN(s): ${resolvedDns.join(' | ')}`);

        const groupMembershipFilter = resolvedDns
            .map((dn) => `(memberOf=${this.escapeLdapFilterValue(dn)})`)
            .join('');

        return `(&(objectClass=user)(objectCategory=person)(|${groupMembershipFilter}))`;
    }

    private async resolveGroupDn(client: Client, baseDn: string, groupNameOrDn: string): Promise<string | null> {
        const raw = groupNameOrDn.trim();
        if (!raw) {
            return null;
        }

        if (this.looksLikeDistinguishedName(raw)) {
            return raw;
        }

        const escaped = this.escapeLdapFilterValue(raw);
        const { searchEntries } = await client.search(baseDn, {
            scope: 'sub',
            filter: `(&(objectClass=group)(|(cn=${escaped})(name=${escaped})))`,
            attributes: ['distinguishedName', 'cn', 'name'],
            sizeLimit: 20,
            timeLimit: 30,
        });

        if (!searchEntries.length) {
            return null;
        }

        const exactMatch = searchEntries.find((entry) => {
            const cn = this.getAttr(entry, 'cn');
            const name = this.getAttr(entry, 'name');
            return cn.toLowerCase() === raw.toLowerCase() || name.toLowerCase() === raw.toLowerCase();
        });

        const selected = exactMatch ?? searchEntries[0];
        const dn = this.getAttr(selected, 'distinguishedName');
        if (!dn) {
            return null;
        }

        if (searchEntries.length > 1 && !exactMatch) {
            this.logger.warn(`Multiple AD groups matched "${raw}"; using "${dn}"`);
        }

        return dn;
    }

    private mapAndDeduplicateEntries(entries: Record<string, unknown>[], configName: string): AdUserEntry[] {
        const deduplicated = new Map<string, AdUserEntry>();
        let missingKeyAttributes = 0;
        let duplicates = 0;

        for (const entry of entries) {
            const mapped = this.mapEntry(entry);
            const key = mapped.externalId.trim().toLowerCase();
            if (!key || !mapped.username.trim()) {
                missingKeyAttributes++;
                continue;
            }

            if (!deduplicated.has(key)) {
                deduplicated.set(key, mapped);
                continue;
            }

            duplicates++;
            const existing = deduplicated.get(key)!;
            existing.groupNames = [...new Set([...(existing.groupNames ?? []), ...(mapped.groupNames ?? [])])];
        }

        if (duplicates > 0) {
            this.logger.warn(`Deduplicated ${duplicates} duplicate AD user entries for "${configName}"`);
        }
        if (missingKeyAttributes > 0) {
            this.logger.warn(`Skipped ${missingKeyAttributes} AD entries missing required key attributes for "${configName}"`);
        }

        return [...deduplicated.values()];
    }

    private looksLikeDistinguishedName(value: string): boolean {
        return /(^|,)\s*[a-zA-Z]+\s*=\s*[^,]+/.test(value);
    }

    private escapeLdapFilterValue(value: string): string {
        return value
            .replace(/\\/g, '\\5c')
            .replace(/\*/g, '\\2a')
            .replace(/\(/g, '\\28')
            .replace(/\)/g, '\\29')
            .replace(/\u0000/g, '\\00');
    }

    mapEntry(entry: Record<string, unknown>): AdUserEntry {
        const samAccount = this.getAttr(entry, 'sAMAccountName');
        return {
            externalId: samAccount,
            username: samAccount,
            firstName: this.getAttr(entry, 'givenName') || samAccount,
            lastName: this.getAttr(entry, 'sn') || '',
            email: this.getAttr(entry, 'mail') || null,
            phone: this.getAttr(entry, 'telephoneNumber') || null,
            mobile: this.getAttr(entry, 'mobile') || null,
            department: this.getAttr(entry, 'department') || null,
            title: this.getAttr(entry, 'title') || null,
            employeeId: this.getAttr(entry, 'employeeID') || null,
            idNumber: this.getAttr(entry, 'idcard') || null,
            company: this.getAttr(entry, 'company') || null,
            groupNames: this.extractGroupNames(entry),
            groupExternalIds: this.extractGroupExternalIds(entry),
            isDisabled: this.isAccountDisabled(entry),
        };
    }

    private extractGroupExternalIds(entry: Record<string, unknown>): string[] {
        const raw = entry.tokenGroups;
        if (!raw) return [];

        const values = Array.isArray(raw) ? raw : [raw];
        const ids = new Set<string>();

        for (const value of values) {
            if (!value) continue;

            if (typeof value === 'string') {
                const normalized = value.trim();
                if (normalized) {
                    ids.add(normalized);
                }
                continue;
            }

            if (value instanceof Uint8Array) {
                ids.add(Buffer.from(value).toString('base64'));
                continue;
            }

            if (Buffer.isBuffer(value)) {
                ids.add(value.toString('base64'));
            }
        }

        return [...ids];
    }

    private extractGroupNames(entry: Record<string, unknown>): string[] {
        const raw = entry.memberOf;
        if (!raw) return [];

        const values = Array.isArray(raw) ? raw : [raw];
        const names = new Set<string>();

        for (const value of values) {
            const rawGroup = String(value ?? '').trim();
            if (!rawGroup) continue;

            // Keep full DN as-is so mappings can use full AD path if needed.
            names.add(rawGroup);

            // Also extract CN=<name> for simpler mapping by group display name.
            const cnMatch = rawGroup.match(/CN=([^,]+)/i);
            const cn = cnMatch?.[1]?.trim();
            if (cn) {
                names.add(cn);
            }
        }

        return [...names];
    }

    private buildLdapUrl(config: AdConfiguration): string {
        const port = config.port || 389;
        if (config.useSsl) {
            const rawUrl = config.ldapUrl.startsWith('ldap')
                ? config.ldapUrl
                : `ldap://${config.ldapUrl}`;
            const hostname = new URL(rawUrl).hostname;
            return `ldaps://${hostname}:${port}`;
        }
        if (config.ldapUrl.includes('://')) {
            try {
                const parsed = new URL(config.ldapUrl);
                return `${parsed.protocol}//${parsed.hostname}:${port}`;
            } catch {
                return `ldap://${config.ldapUrl}:${port}`;
            }
        }
        return `ldap://${config.ldapUrl}:${port}`;
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

    /**
     * Checks if the AD account is disabled via the userAccountControl bitmask.
     * Bit 0x2 (ACCOUNTDISABLE) indicates a disabled account.
     */
    private isAccountDisabled(entry: Record<string, unknown>): boolean {
        const uac = parseInt(this.getAttr(entry, 'userAccountControl'), 10);
        if (isNaN(uac)) return false;
        return (uac & 0x2) !== 0;
    }
}
