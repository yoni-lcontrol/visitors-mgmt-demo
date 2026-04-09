import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from 'ldapts';
import { AdConfiguration } from './entities/ad-configuration.entity';

export interface AdPersonResult {
    firstName: string;
    lastName: string;
    displayName: string;
    email: string | null;
    phone: string | null;
}

export class AdSearchException extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
    }
}

@Injectable()
export class AdSearchService {
    private readonly logger = new Logger(AdSearchService.name);

    constructor(
        @InjectRepository(AdConfiguration)
        private readonly adConfigRepo: Repository<AdConfiguration>,
    ) { }

    async searchPeople(query: string): Promise<AdPersonResult[]> {
        const config = await this.adConfigRepo.findOne({
            where: { isActive: true },
            order: { createdAt: 'ASC' },
        });
        if (!config) {
            this.logger.warn('No active AD configuration found');
            throw new AdSearchException('AD_NO_CONFIG', 'No active AD configuration found');
        }

        const escaped = this.escapeLdapFilter(query);
        const filter = `(&(objectClass=person)(objectCategory=person)(|(givenName=${escaped}*)(sn=${escaped}*)(displayName=*${escaped}*)))`;

        const url = config.useSsl
            ? `ldaps://${new URL(config.ldapUrl.startsWith('ldap') ? config.ldapUrl : `ldap://${config.ldapUrl}`).hostname}:${config.port}`
            : config.ldapUrl.includes('://') ? config.ldapUrl : `ldap://${config.ldapUrl}:${config.port}`;

        const client = new Client({ url, tlsOptions: config.useSsl ? { rejectUnauthorized: false } : undefined });

        try {
            const bindDn = config.username.includes('@') || config.username.includes('\\')
                ? config.username
                : `${config.username}@${config.domain}`;

            await client.bind(bindDn, config.password);

            const { searchEntries } = await client.search(config.baseDn ?? `DC=${config.domain.split('.').join(',DC=')}`, {
                scope: 'sub',
                filter,
                attributes: ['givenName', 'sn', 'displayName', 'mail', 'telephoneNumber', 'mobile'],
                sizeLimit: 15,
                timeLimit: 10,
            });

            return searchEntries.map(entry => ({
                firstName: this.getStringAttr(entry, 'givenName'),
                lastName: this.getStringAttr(entry, 'sn'),
                displayName: this.getStringAttr(entry, 'displayName'),
                email: this.getStringAttr(entry, 'mail') || null,
                phone: this.getStringAttr(entry, 'telephoneNumber') || this.getStringAttr(entry, 'mobile') || null,
            }));
        } catch (err) {
            if (err instanceof AdSearchException) throw err;
            const msg = (err as Error).message ?? '';
            this.logger.error(`AD search failed: ${msg}`, (err as Error).stack);
            if (/invalid credentials|authentication|bind/i.test(msg)) {
                throw new AdSearchException('AD_AUTH_FAILED', 'AD authentication failed');
            }
            if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|connect/i.test(msg)) {
                throw new AdSearchException('AD_CONNECTION_FAILED', 'Unable to connect to AD server');
            }
            if (/timeout|timelimit/i.test(msg)) {
                throw new AdSearchException('AD_TIMEOUT', 'AD search timed out');
            }
            throw new AdSearchException('AD_SEARCH_FAILED', 'AD search failed');
        } finally {
            try { await client.unbind(); } catch { /* ignore unbind errors */ }
        }
    }

    private getStringAttr(entry: Record<string, unknown>, attr: string): string {
        const val = entry[attr];
        if (!val) return '';
        if (Array.isArray(val)) return String(val[0] ?? '');
        return String(val);
    }

    private escapeLdapFilter(input: string): string {
        return input.replace(/([\\*()|\0/])/g, (ch) => {
            return '\\' + ch.charCodeAt(0).toString(16).padStart(2, '0');
        });
    }

    /**
     * HTTP-friendly wrapper around searchPeople.
     * Translates AdSearchException into BadGatewayException for the controller layer.
     */
    async searchPeopleHttp(query: string): Promise<AdPersonResult[]> {
        try {
            return await this.searchPeople(query);
        } catch (err) {
            const code = err instanceof AdSearchException ? err.code : 'AD_SEARCH_FAILED';
            throw new BadGatewayException({ statusCode: 502, code });
        }
    }
}
