import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { AdSyncAdapterService, AdUserEntry, AdConnectionException } from './ad-sync-adapter.service';
import { AuditService } from '../audit/audit.service';
import { hashPassword } from '../common/utils/hash.util';

export interface AdSyncConfigResult {
    configId: string;
    configName: string;
    fetched: number;
    created: number;
    updated: number;
    deactivated: number;
    skipped: number;
    error: string | null;
}

export interface AdSyncResult {
    configsProcessed: number;
    configsFailed: number;
    totalFetched: number;
    totalCreated: number;
    totalUpdated: number;
    totalDeactivated: number;
    totalSkipped: number;
    details: AdSyncConfigResult[];
    durationMs: number;
}

@Injectable()
export class AdSyncService {
    private readonly logger = new Logger(AdSyncService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(AdConfiguration)
        private readonly adConfigRepo: Repository<AdConfiguration>,
        private readonly adAdapter: AdSyncAdapterService,
        private readonly auditService: AuditService,
    ) { }

    async syncAll(triggeredBy?: string): Promise<AdSyncResult> {
        const startTime = Date.now();
        this.logger.log('AD sync started');

        const configs = await this.adConfigRepo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });

        if (!configs.length) {
            this.logger.warn('No active AD configurations found, skipping sync');
            return this.buildEmptyResult(startTime);
        }

        this.logger.log(`Found ${configs.length} active AD configuration(s)`);
        const details: AdSyncConfigResult[] = [];

        for (const config of configs) {
            const configResult = await this.syncSingleConfig(config, triggeredBy);
            details.push(configResult);
        }

        const result = this.aggregateResults(details, startTime);

        this.logger.log(
            `AD sync completed in ${result.durationMs}ms — ` +
            `configs: ${result.configsProcessed}/${configs.length}, ` +
            `fetched: ${result.totalFetched}, created: ${result.totalCreated}, ` +
            `updated: ${result.totalUpdated}, deactivated: ${result.totalDeactivated}, ` +
            `skipped: ${result.totalSkipped}, failed: ${result.configsFailed}`,
        );

        this.auditService.log({
            userId: triggeredBy,
            module: 'users',
            action: 'UPDATE',
            entity: 'AdSync',
            description: `AD sync completed: ${result.totalCreated} created, ${result.totalUpdated} updated, ${result.totalDeactivated} deactivated`,
            newValue: {
                configsProcessed: result.configsProcessed,
                configsFailed: result.configsFailed,
                totalCreated: result.totalCreated,
                totalUpdated: result.totalUpdated,
                totalDeactivated: result.totalDeactivated,
                durationMs: result.durationMs,
            },
        }).catch(() => { });

        return result;
    }

    private async syncSingleConfig(
        config: AdConfiguration,
        triggeredBy?: string,
    ): Promise<AdSyncConfigResult> {
        const configResult: AdSyncConfigResult = {
            configId: config.id,
            configName: config.name,
            fetched: 0,
            created: 0,
            updated: 0,
            deactivated: 0,
            skipped: 0,
            error: null,
        };

        try {
            this.logger.log(`Syncing AD config "${config.name}" (${config.id})`);

            // Fetch users from AD
            const adUsers = await this.adAdapter.fetchUsers(config);
            configResult.fetched = adUsers.length;

            if (adUsers.length === 0) {
                this.logger.warn(`No users returned from AD "${config.name}", skipping sync for safety`);
                return configResult;
            }

            // Load all local users linked to this AD source
            const localUsers = await this.userRepo.find({
                where: { adSourceId: config.id },
            });

            // Build lookup maps
            const localByExternalId = new Map<string, User>();
            for (const user of localUsers) {
                if (user.adExternalId) {
                    localByExternalId.set(user.adExternalId.toLowerCase(), user);
                }
            }

            // Also build a username lookup for matching existing users on first sync
            const localByUsername = new Map<string, User>();
            const unmatchedLocals = await this.userRepo.find({
                where: { syncSource: 'local' },
            });
            for (const user of unmatchedLocals) {
                localByUsername.set(user.username.toLowerCase(), user);
            }

            // Track which local AD-sourced users are still in AD
            const matchedLocalIds = new Set<string>();
            const now = new Date();

            // Process each AD user
            for (const adUser of adUsers) {
                if (!adUser.externalId) {
                    configResult.skipped++;
                    continue;
                }

                const externalIdLower = adUser.externalId.toLowerCase();

                // Try to find by adExternalId first
                let localUser = localByExternalId.get(externalIdLower);

                // Fallback: match by username for users that haven't been synced yet
                if (!localUser) {
                    const byUsername = localByUsername.get(adUser.username.toLowerCase());
                    if (byUsername && byUsername.syncSource === 'local') {
                        localUser = byUsername;
                    }
                }

                if (localUser) {
                    // Update existing user
                    const updated = await this.updateUser(localUser, adUser, config.id, now, triggeredBy);
                    if (updated) {
                        configResult.updated++;
                    } else {
                        configResult.skipped++;
                    }
                    matchedLocalIds.add(localUser.id);
                } else {
                    // Create new user
                    const newUser = await this.createUser(adUser, config.id, now, triggeredBy);
                    matchedLocalIds.add(newUser.id);
                    configResult.created++;
                }
            }

            // Deactivate local users that are linked to this AD source but no longer in AD
            const toDeactivate = localUsers.filter(
                u => u.isActive && !matchedLocalIds.has(u.id),
            );
            for (const user of toDeactivate) {
                user.isActive = false;
                user.lastSyncedAt = now;
                user.updatedBy = triggeredBy ?? null;
                await this.userRepo.save(user);
                configResult.deactivated++;
                this.logger.log(`Deactivated user "${user.username}" (no longer in AD "${config.name}")`);
            }

            this.logger.log(
                `Config "${config.name}" sync done — ` +
                `fetched: ${configResult.fetched}, created: ${configResult.created}, ` +
                `updated: ${configResult.updated}, deactivated: ${configResult.deactivated}, ` +
                `skipped: ${configResult.skipped}`,
            );
        } catch (err) {
            const msg = err instanceof AdConnectionException ? err.message : (err as Error).message ?? 'Unknown error';
            configResult.error = msg;
            this.logger.error(
                `AD sync failed for config "${config.name}": ${msg}`,
                err instanceof AdConnectionException ? undefined : (err as Error).stack,
            );
        }

        return configResult;
    }

    private async updateUser(
        localUser: User,
        adUser: AdUserEntry,
        configId: string,
        now: Date,
        triggeredBy?: string,
    ): Promise<boolean> {
        let changed = false;

        // Sync AD metadata unconditionally
        if (localUser.adSourceId !== configId) { localUser.adSourceId = configId; changed = true; }
        if (localUser.adExternalId !== adUser.externalId) { localUser.adExternalId = adUser.externalId; changed = true; }
        if (localUser.syncSource !== 'ad') { localUser.syncSource = 'ad'; changed = true; }

        // Sync mapped fields (only if AD provides a value)
        if (adUser.firstName && localUser.firstName !== adUser.firstName) { localUser.firstName = adUser.firstName; changed = true; }
        if (adUser.lastName && localUser.lastName !== adUser.lastName) { localUser.lastName = adUser.lastName; changed = true; }
        if (adUser.email && localUser.email !== adUser.email) { localUser.email = adUser.email; changed = true; }
        if (adUser.phone && localUser.phone !== adUser.phone) { localUser.phone = adUser.phone; changed = true; }
        if (adUser.department !== undefined && localUser.department !== adUser.department) { localUser.department = adUser.department; changed = true; }
        if (adUser.title !== undefined && localUser.title !== adUser.title) { localUser.title = adUser.title; changed = true; }
        if (adUser.idNumber !== undefined && localUser.idNumber !== adUser.idNumber) { localUser.idNumber = adUser.idNumber; changed = true; }

        // Reactivate if deactivated
        if (!localUser.isActive) { localUser.isActive = true; changed = true; }

        // Always update lastSyncedAt
        localUser.lastSyncedAt = now;
        localUser.updatedBy = triggeredBy ?? null;

        if (changed) {
            await this.userRepo.save(localUser);
        } else {
            // Even if nothing else changed, update lastSyncedAt
            await this.userRepo.update(localUser.id, {
                lastSyncedAt: now,
                updatedBy: triggeredBy ?? null,
            });
        }

        return changed;
    }

    private async createUser(
        adUser: AdUserEntry,
        configId: string,
        now: Date,
        triggeredBy?: string,
    ): Promise<User> {
        const placeholder = await hashPassword(
            `AD_SYNC_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        );

        const user = this.userRepo.create({
            username: adUser.username,
            passwordHash: placeholder,
            firstName: adUser.firstName,
            lastName: adUser.lastName || '-',
            email: adUser.email,
            phone: adUser.phone,
            department: adUser.department,
            title: adUser.title,
            idNumber: adUser.idNumber,
            adSourceId: configId,
            adExternalId: adUser.externalId,
            syncSource: 'ad',
            lastSyncedAt: now,
            createdBy: triggeredBy ?? null,
            updatedBy: triggeredBy ?? null,
        });

        const saved = await this.userRepo.save(user);
        this.logger.log(`Created user "${adUser.username}" from AD config "${configId}"`);
        return saved;
    }

    private buildEmptyResult(startTime: number): AdSyncResult {
        return {
            configsProcessed: 0,
            configsFailed: 0,
            totalFetched: 0,
            totalCreated: 0,
            totalUpdated: 0,
            totalDeactivated: 0,
            totalSkipped: 0,
            details: [],
            durationMs: Date.now() - startTime,
        };
    }

    private aggregateResults(details: AdSyncConfigResult[], startTime: number): AdSyncResult {
        return {
            configsProcessed: details.filter(d => !d.error).length,
            configsFailed: details.filter(d => !!d.error).length,
            totalFetched: details.reduce((sum, d) => sum + d.fetched, 0),
            totalCreated: details.reduce((sum, d) => sum + d.created, 0),
            totalUpdated: details.reduce((sum, d) => sum + d.updated, 0),
            totalDeactivated: details.reduce((sum, d) => sum + d.deactivated, 0),
            totalSkipped: details.reduce((sum, d) => sum + d.skipped, 0),
            details,
            durationMs: Date.now() - startTime,
        };
    }
}
