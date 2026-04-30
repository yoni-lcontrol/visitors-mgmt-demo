import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Client } from 'ldapts';
import { User } from './entities/user.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { AdGroupRoleMapping } from '../ad-group-role-mappings/entities/ad-group-role-mapping.entity';
import { SectorsService } from '../sectors/sectors.service';

export interface AdImportResult {
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
}

interface AdUserEntry {
    username: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    idNumber: string | null;
    company: string | null;
    isDisabled: boolean;
}

@Injectable()
export class AdImportService {
    private readonly logger = new Logger(AdImportService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(AdConfiguration)
        private readonly adConfigRepo: Repository<AdConfiguration>,
        @InjectRepository(AdGroupRoleMapping)
        private readonly adGroupRoleMappingRepo: Repository<AdGroupRoleMapping>,
        private readonly sectorsService: SectorsService,
    ) { }

    async importFromAllAds(currentUserId?: string): Promise<AdImportResult> {
        const configs = await this.adConfigRepo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });

        if (!configs.length) {
            return { imported: 0, updated: 0, skipped: 0, errors: ['NO_AD_CONFIG'] };
        }

        const totals: AdImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

        for (const config of configs) {
            try {
                const adUsers = await this.fetchUsersFromAd(config);
                const result = await this.upsertUsers(adUsers, currentUserId);
                totals.imported += result.imported;
                totals.updated += result.updated;
                totals.skipped += result.skipped;
            } catch (err) {
                const msg = (err as Error).message ?? 'Unknown error';
                this.logger.error(`AD import failed for "${config.name}": ${msg}`, (err as Error).stack);
                totals.errors.push(config.name);
            }
        }

        return totals;
    }

    private async fetchUsersFromAd(config: AdConfiguration): Promise<AdUserEntry[]> {
        const url = config.useSsl
            ? `ldaps://${new URL(config.ldapUrl.startsWith('ldap') ? config.ldapUrl : `ldap://${config.ldapUrl}`).hostname}:${config.port}`
            : config.ldapUrl.includes('://') ? config.ldapUrl : `ldap://${config.ldapUrl}:${config.port}`;

        const client = new Client({
            url,
            tlsOptions: config.useSsl ? { rejectUnauthorized: false } : undefined,
            connectTimeout: 10_000,
        });

        try {
            const bindDn = config.username.includes('@') || config.username.includes('\\')
                ? config.username
                : `${config.username}@${config.domain}`;

            await client.bind(bindDn, config.password);

            const baseDn = config.baseDn ?? `DC=${config.domain.split('.').join(',DC=')}`;

            // Build group-scoped filter from AdGroupRoleMappings
            const targetGroups = await this.resolveTargetGroups(config.id);
            let filter: string;
            if (targetGroups.length) {
                const groupDns = await this.resolveGroupDns(client, baseDn, targetGroups);
                if (groupDns.length) {
                    const memberOfClauses = groupDns.map(dn => `(memberOf=${this.escapeLdapFilterValue(dn)})`).join('');
                    filter = `(&(objectClass=user)(objectCategory=person)(|${memberOfClauses}))`;
                } else {
                    this.logger.warn(`None of the configured AD groups were found for "${config.name}", fetching all users`);
                    filter = '(&(objectClass=user)(objectCategory=person))';
                }
            } else {
                filter = '(&(objectClass=user)(objectCategory=person))';
            }

            const { searchEntries } = await client.search(baseDn, {
                scope: 'sub',
                filter,
                attributes: ['sAMAccountName', 'userPrincipalName', 'givenName', 'sn', 'mail', 'telephoneNumber', 'mobile', 'employeeID', 'company', 'userAccountControl'],
                paged: { pageSize: 500 },
                timeLimit: 60,
            });

            return searchEntries
                .filter(entry => this.getAttr(entry, 'sAMAccountName'))
                .map(entry => ({
                    username: this.getAttr(entry, 'sAMAccountName'),
                    firstName: this.getAttr(entry, 'givenName') || this.getAttr(entry, 'sAMAccountName'),
                    lastName: this.getAttr(entry, 'sn') || '',
                    email: this.getAttr(entry, 'mail') || null,
                    phone: this.getAttr(entry, 'telephoneNumber') || this.getAttr(entry, 'mobile') || null,
                    idNumber: this.getAttr(entry, 'employeeID') || null,
                    company: this.getAttr(entry, 'company') || null,
                    isDisabled: this.isAccountDisabled(entry),
                }));
        } finally {
            try { await client.unbind(); } catch { /* ignore */ }
        }
    }

    private async upsertUsers(
        adUsers: AdUserEntry[],
        currentUserId?: string,
    ): Promise<{ imported: number; updated: number; skipped: number }> {
        let imported = 0;
        let updated = 0;
        let skipped = 0;

        // Build sector lookup: company name → sector id
        const sectorCache = new Map<string, string>();

        for (const adUser of adUsers) {
            if (!adUser.username) {
                skipped++;
                continue;
            }

            // Resolve sector from AD company field
            let sectorId: string | null = null;
            if (adUser.company) {
                if (sectorCache.has(adUser.company)) {
                    sectorId = sectorCache.get(adUser.company)!;
                } else {
                    const sector = await this.sectorsService.findOrCreateByName(adUser.company);
                    sectorId = sector.id;
                    sectorCache.set(adUser.company, sectorId);
                }
            }

            const existing = await this.userRepo.findOne({
                where: { username: adUser.username },
            });

            if (existing) {
                let changed = false;
                if (adUser.firstName && existing.firstName !== adUser.firstName) { existing.firstName = adUser.firstName; changed = true; }
                if (adUser.lastName && existing.lastName !== adUser.lastName) { existing.lastName = adUser.lastName; changed = true; }
                if (adUser.email && existing.email !== adUser.email) { existing.email = adUser.email; changed = true; }
                if (adUser.phone && existing.phone !== adUser.phone) { existing.phone = adUser.phone; changed = true; }
                if (adUser.idNumber && existing.idNumber !== adUser.idNumber) { existing.idNumber = adUser.idNumber; changed = true; }

                // Sync sector (company → תחום)
                if (existing.sectorId !== sectorId) { existing.sectorId = sectorId; changed = true; }

                // Sync active status from AD disabled flag
                const shouldBeActive = !adUser.isDisabled;
                if (existing.isActive !== shouldBeActive) {
                    existing.isActive = shouldBeActive;
                    changed = true;
                }

                if (changed) {
                    existing.updatedBy = currentUserId ?? null;
                    await this.userRepo.save(existing);
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                const user = this.userRepo.create({
                    username: adUser.username,
                    passwordHash: null,
                    firstName: adUser.firstName,
                    lastName: adUser.lastName || '-',
                    email: adUser.email,
                    phone: adUser.phone,
                    idNumber: adUser.idNumber,
                    sectorId,
                    isActive: !adUser.isDisabled,
                    createdBy: currentUserId ?? null,
                    updatedBy: currentUserId ?? null,
                });
                await this.userRepo.save(user);
                imported++;
            }
        }

        return { imported, updated, skipped };
    }

    private async resolveTargetGroups(configId: string): Promise<string[]> {
        const mappings = await this.adGroupRoleMappingRepo.find({
            where: [
                { adSourceId: configId },
                { adSourceId: IsNull() },
            ],
        });

        const unique = new Map<string, string>();
        for (const mapping of mappings) {
            const name = mapping.groupName?.trim();
            if (name) {
                const key = name.toLowerCase();
                if (!unique.has(key)) unique.set(key, name);
            }
        }
        return [...unique.values()];
    }

    private async resolveGroupDns(client: Client, baseDn: string, groupNames: string[]): Promise<string[]> {
        const dns: string[] = [];
        for (const name of groupNames) {
            const escaped = this.escapeLdapFilterValue(name);
            const { searchEntries } = await client.search(baseDn, {
                scope: 'sub',
                filter: `(&(objectClass=group)(|(cn=${escaped})(name=${escaped})))`,
                attributes: ['distinguishedName'],
                sizeLimit: 5,
                timeLimit: 15,
            });
            if (searchEntries.length) {
                const dn = this.getAttr(searchEntries[0], 'distinguishedName');
                if (dn) dns.push(dn);
            } else {
                this.logger.warn(`AD group "${name}" not found`);
            }
        }
        return dns;
    }

    private escapeLdapFilterValue(value: string): string {
        return value
            .replace(/\\/g, '\\5c')
            .replace(/\*/g, '\\2a')
            .replace(/\(/g, '\\28')
            .replace(/\)/g, '\\29')
            .replace(/\u0000/g, '\\00');
    }

    private getAttr(entry: Record<string, unknown>, attr: string): string {
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
