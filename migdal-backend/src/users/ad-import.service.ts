import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from 'ldapts';
import { User } from './entities/user.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { hashPassword } from '../common/utils/hash.util';

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
}

@Injectable()
export class AdImportService {
    private readonly logger = new Logger(AdImportService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(AdConfiguration)
        private readonly adConfigRepo: Repository<AdConfiguration>,
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
            const filter = '(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))';

            const { searchEntries } = await client.search(baseDn, {
                scope: 'sub',
                filter,
                attributes: ['sAMAccountName', 'userPrincipalName', 'givenName', 'sn', 'mail', 'telephoneNumber', 'mobile', 'employeeID'],
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

        for (const adUser of adUsers) {
            if (!adUser.username) {
                skipped++;
                continue;
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

                if (!existing.isActive) {
                    existing.isActive = true;
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
                const placeholder = await hashPassword(
                    `AD_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                );

                const user = this.userRepo.create({
                    username: adUser.username,
                    passwordHash: placeholder,
                    firstName: adUser.firstName,
                    lastName: adUser.lastName || '-',
                    email: adUser.email,
                    phone: adUser.phone,
                    idNumber: adUser.idNumber,
                    createdBy: currentUserId ?? null,
                    updatedBy: currentUserId ?? null,
                });
                await this.userRepo.save(user);
                imported++;
            }
        }

        return { imported, updated, skipped };
    }

    private getAttr(entry: Record<string, unknown>, attr: string): string {
        const val = entry[attr];
        if (!val) return '';
        if (Array.isArray(val)) return String(val[0] ?? '');
        return String(val);
    }
}
