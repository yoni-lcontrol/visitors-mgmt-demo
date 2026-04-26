import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, IsNull, QueryRunner } from 'typeorm';
import { User } from './entities/user.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { AdSyncAdapterService, AdUserEntry, AdConnectionException } from './ad-sync-adapter.service';
import { SectorsService } from '../sectors/sectors.service';
import { AuditService } from '../audit/audit.service';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { WsEvent } from '../websocket/enums/ws-events.enum';
import { hashPassword } from '../common/utils/hash.util';
import { AdGroupRoleMapping } from '../ad-group-role-mappings/entities/ad-group-role-mapping.entity';
import { Role } from '../roles/entities/role.entity';

const DEFAULT_BATCH_SIZE = 50;
const DB_WRITE_BATCH_SIZE = 100;

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

interface AdGroupRoleResolver {
    mappingGroupNames: string[];
    byExternalId: Map<string, Role>;
    byGroupName: Map<string, Role>;
}

@Injectable()
export class AdSyncService {
    private readonly logger = new Logger(AdSyncService.name);
    private readonly batchSize: number;
    private readonly envTargetGroups: string[];

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(AdConfiguration)
        private readonly adConfigRepo: Repository<AdConfiguration>,
        @InjectRepository(AdGroupRoleMapping)
        private readonly adGroupRoleMappingRepo: Repository<AdGroupRoleMapping>,
        private readonly adAdapter: AdSyncAdapterService,
        private readonly sectorsService: SectorsService,
        private readonly auditService: AuditService,
        private readonly usersGateway: UsersGateway,
        private readonly configService: ConfigService,
        private readonly dataSource: DataSource,
    ) {
        const envBatch = this.configService.get<number>('AD_SYNC_BATCH_SIZE');
        this.batchSize = envBatch && envBatch > 0 ? envBatch : DEFAULT_BATCH_SIZE;
        this.envTargetGroups = this.parseEnvTargetGroups(this.configService.get<string>('AD_SYNC_TARGET_GROUPS'));
    }

    async syncAll(triggeredBy?: string): Promise<AdSyncResult> {
        const startTime = Date.now();
        this.logger.log('AD sync started');

        const configs = await this.adConfigRepo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });

        if (!configs.length) {
            this.logger.warn('No active AD configurations found, skipping sync');
            this.emitProgress({ phase: 'idle', message: 'No active AD configurations', current: 0, total: 0, created: 0, updated: 0, deactivated: 0, skipped: 0 });
            return this.buildEmptyResult(startTime);
        }

        this.logger.log(`Found ${configs.length} active AD configuration(s)`);
        this.emitProgress({ phase: 'fetching', message: 'Connecting to Active Directory...', current: 0, total: 0, created: 0, updated: 0, deactivated: 0, skipped: 0 });

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

        this.usersGateway.broadcastToAll(WsEvent.AdSyncCompleted, {
            configsProcessed: result.configsProcessed,
            configsFailed: result.configsFailed,
            totalCreated: result.totalCreated,
            totalUpdated: result.totalUpdated,
            totalDeactivated: result.totalDeactivated,
            totalSkipped: result.totalSkipped,
            durationMs: result.durationMs,
            details: result.details,
        });

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
            this.logger.log(`Syncing AD config "${config.name}" (${config.id}), batchSize=${this.batchSize}`);

            // Resolve AD group-name -> role mapping and sync groups once per config run
            const groupRoleResolver = await this.loadGroupRoleResolver(config.id);
            const configuredTargetGroups = this.resolveTargetGroupsForConfig(config, groupRoleResolver);

            // Fetch users from AD
            const fetchStart = Date.now();
            const adUsers = configuredTargetGroups.length
                ? await this.adAdapter.fetchUsers(config, { targetGroups: configuredTargetGroups })
                : await this.adAdapter.fetchUsers(config);
            configResult.fetched = adUsers.length;
            this.logger.log(
                `Fetched ${adUsers.length} users from AD "${config.name}" in ${Date.now() - fetchStart}ms` +
                (configuredTargetGroups.length ? ` (group-scoped: ${configuredTargetGroups.length} groups)` : ' (legacy all-users mode)'),
            );

            if (adUsers.length === 0) {
                this.logger.warn(`No users returned from AD "${config.name}", skipping sync for safety`);
                return configResult;
            }

            this.emitProgress({
                phase: 'fetching',
                message: `Fetched ${adUsers.length} users from "${config.name}", resolving...`,
                current: 0,
                total: adUsers.length,
                created: 0, updated: 0, deactivated: 0, skipped: 0,
            });

            // Load all local users linked to this AD source
            const localUsers = await this.userRepo.find({
                where: { adSourceId: config.id },
                relations: ['roles'],
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

            // Pre-resolve sectors in a single pass
            const sectorCache = new Map<string, string>();
            const uniqueCompanies = new Set<string>();
            for (const adUser of adUsers) {
                if (adUser.company) uniqueCompanies.add(adUser.company);
            }
            for (const company of uniqueCompanies) {
                const sector = await this.sectorsService.findOrCreateByName(company);
                sectorCache.set(company, sector.id);
            }

            // Pre-hash a single placeholder password for all new users in this run
            const placeholderHash = await hashPassword(
                `AD_SYNC_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            );

            // Process each AD user — separate creates from updates
            let processed = 0;
            const pendingCreates: User[] = [];
            const pendingUpdates: User[] = [];
            const unchangedIds: string[] = [];

            for (const adUser of adUsers) {
                if (!adUser.externalId) {
                    configResult.skipped++;
                    processed++;
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
                    const sectorId = adUser.company ? sectorCache.get(adUser.company) ?? null : null;
                    const matchedRoles = this.resolveRolesForAdUser(adUser, groupRoleResolver);
                    const changed = this.applyUserUpdates(localUser, adUser, config.id, sectorId, matchedRoles, now, triggeredBy);
                    if (changed) {
                        pendingUpdates.push(localUser);
                        configResult.updated++;
                    } else {
                        unchangedIds.push(localUser.id);
                        configResult.skipped++;
                    }
                    matchedLocalIds.add(localUser.id);
                } else {
                    // Create new user
                    const sectorId = adUser.company ? sectorCache.get(adUser.company) ?? null : null;
                    const matchedRoles = this.resolveRolesForAdUser(adUser, groupRoleResolver);
                    const newUser = this.buildNewUser(adUser, config.id, sectorId, matchedRoles, now, placeholderHash, triggeredBy);
                    pendingCreates.push(newUser);
                    configResult.created++;
                }

                processed++;

                // Flush creates via bulk insert in transaction
                if (pendingCreates.length >= DB_WRITE_BATCH_SIZE) {
                    const inserted = await this.flushInserts(pendingCreates);
                    for (const u of inserted) matchedLocalIds.add(u.id);
                    this.logger.debug(`Bulk-inserted ${pendingCreates.length} new users for "${config.name}"`);
                    pendingCreates.length = 0;
                }

                // Flush updates via batch save in transaction
                if (pendingUpdates.length >= DB_WRITE_BATCH_SIZE) {
                    await this.flushUpdates(pendingUpdates);
                    this.logger.debug(`Batch-updated ${pendingUpdates.length} users for "${config.name}"`);
                    pendingUpdates.length = 0;
                }

                // Flush unchanged IDs batch update
                if (unchangedIds.length >= DB_WRITE_BATCH_SIZE) {
                    await this.bulkUpdateLastSynced(unchangedIds, now, triggeredBy);
                    unchangedIds.length = 0;
                }

                if (processed % this.batchSize === 0 || processed === adUsers.length) {
                    this.emitProgress({
                        phase: 'processing',
                        message: `Processing users from "${config.name}"...`,
                        current: processed,
                        total: adUsers.length,
                        created: configResult.created,
                        updated: configResult.updated,
                        deactivated: configResult.deactivated,
                        skipped: configResult.skipped,
                    });
                }
            }

            // Flush remaining creates
            if (pendingCreates.length > 0) {
                const inserted = await this.flushInserts(pendingCreates);
                for (const u of inserted) matchedLocalIds.add(u.id);
                this.logger.debug(`Bulk-inserted final ${pendingCreates.length} new users for "${config.name}"`);
            }

            // Flush remaining updates
            if (pendingUpdates.length > 0) {
                await this.flushUpdates(pendingUpdates);
                this.logger.debug(`Batch-updated final ${pendingUpdates.length} users for "${config.name}"`);
            }

            // Flush remaining unchanged IDs
            if (unchangedIds.length > 0) {
                await this.bulkUpdateLastSynced(unchangedIds, now, triggeredBy);
            }

            // Deactivate local users that are linked to this AD source but no longer in AD
            const toDeactivate = localUsers.filter(
                u => u.isActive && !matchedLocalIds.has(u.id),
            );
            if (toDeactivate.length > 0) {
                const deactivateIds = toDeactivate.map(u => u.id);
                for (let i = 0; i < deactivateIds.length; i += DB_WRITE_BATCH_SIZE) {
                    const chunk = deactivateIds.slice(i, i + DB_WRITE_BATCH_SIZE);
                    await this.userRepo
                        .createQueryBuilder()
                        .update(User)
                        .set({ isActive: false, lastSyncedAt: now, updatedBy: triggeredBy ?? null })
                        .whereInIds(chunk)
                        .execute();
                }
                configResult.deactivated = toDeactivate.length;
                this.logger.log(`Deactivated ${toDeactivate.length} user(s) no longer in AD "${config.name}"`);
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

    /**
     * Applies field updates to a local user entity in-memory (no DB call).
     * Returns true if any field was changed.
     */
    private applyUserUpdates(
        localUser: User,
        adUser: AdUserEntry,
        configId: string,
        sectorId: string | null,
        matchedRoles: Role[],
        now: Date,
        triggeredBy?: string,
    ): boolean {
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

        // Sync sector (company → תחום)
        if (localUser.sectorId !== sectorId) { localUser.sectorId = sectorId; changed = true; }

        // Sync roles from AD group mappings
        const nextRoleId = matchedRoles[0]?.id ?? null;
        if (localUser.roleId !== nextRoleId) {
            localUser.roleId = nextRoleId;
            changed = true;
        }

        const currentRoleIds = new Set((localUser.roles ?? []).map((r) => r.id));
        const nextRoleIds = new Set(matchedRoles.map((r) => r.id));
        if (!this.areIdSetsEqual(currentRoleIds, nextRoleIds)) {
            localUser.roles = matchedRoles;
            changed = true;
        }

        // Sync active status from AD disabled flag
        const shouldBeActive = !adUser.isDisabled;
        if (localUser.isActive !== shouldBeActive) { localUser.isActive = shouldBeActive; changed = true; }

        // Always update lastSyncedAt
        localUser.lastSyncedAt = now;
        localUser.updatedBy = triggeredBy ?? null;

        return changed;
    }

    /**
     * Bulk-insert new users inside a transaction.
     * Uses createQueryBuilder().insert() for true bulk INSERT.
     */
    private async flushInserts(users: User[]): Promise<User[]> {
        if (users.length === 0) return [];
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            const inserted = await qr.manager.save(User, users);
            await qr.commitTransaction();
            return inserted;
        } catch (err) {
            await qr.rollbackTransaction();
            throw err;
        } finally {
            await qr.release();
        }
    }

    /**
     * Batch-save updated users inside a transaction.
     */
    private async flushUpdates(users: User[]): Promise<void> {
        if (users.length === 0) return;
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        try {
            await qr.manager.save(User, users);
            await qr.commitTransaction();
        } catch (err) {
            await qr.rollbackTransaction();
            throw err;
        } finally {
            await qr.release();
        }
    }

    /**
     * Builds a new User entity in-memory (no DB call).
     */
    private buildNewUser(
        adUser: AdUserEntry,
        configId: string,
        sectorId: string | null,
        matchedRoles: Role[],
        now: Date,
        placeholderHash: string,
        triggeredBy?: string,
    ): User {
        return this.userRepo.create({
            username: adUser.username,
            passwordHash: placeholderHash,
            firstName: adUser.firstName,
            lastName: adUser.lastName || '-',
            email: adUser.email,
            phone: adUser.phone,
            department: adUser.department,
            title: adUser.title,
            idNumber: adUser.idNumber,
            sectorId,
            roleId: matchedRoles[0]?.id ?? null,
            roles: matchedRoles,
            isActive: !adUser.isDisabled,
            adSourceId: configId,
            adExternalId: adUser.externalId,
            syncSource: 'ad',
            lastSyncedAt: now,
            createdBy: triggeredBy ?? null,
            updatedBy: triggeredBy ?? null,
        });
    }

    private normalizeGroupName(value: string): string {
        return value.trim().toLowerCase();
    }

    private parseEnvTargetGroups(raw: string | undefined): string[] {
        if (!raw?.trim()) {
            return [];
        }

        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return this.normalizeTargetGroups(parsed.map((value) => String(value)));
            }
        } catch {
            // fallback to CSV parsing
        }

        return this.normalizeTargetGroups(raw.split(','));
    }

    private parseConfigTargetGroups(rawJson: string | null | undefined): string[] {
        if (!rawJson?.trim()) {
            return [];
        }

        try {
            const parsed = JSON.parse(rawJson);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return this.normalizeTargetGroups(parsed.map((value) => String(value)));
        } catch {
            return [];
        }
    }

    private normalizeTargetGroups(groups: string[]): string[] {
        const unique = new Map<string, string>();
        for (const value of groups) {
            const normalized = value.trim();
            if (!normalized) {
                continue;
            }

            const key = normalized.toLowerCase();
            if (!unique.has(key)) {
                unique.set(key, normalized);
            }
        }

        return [...unique.values()];
    }

    private resolveTargetGroupsForConfig(config: AdConfiguration, groupRoleResolver: AdGroupRoleResolver): string[] {
        const configGroups = this.parseConfigTargetGroups((config as any).targetGroupsJson);
        if (configGroups.length) {
            return configGroups;
        }

        if (this.envTargetGroups.length) {
            return this.envTargetGroups;
        }

        const mappingGroups = groupRoleResolver.mappingGroupNames;
        if (mappingGroups.length) {
            return mappingGroups;
        }

        return [];
    }

    private async loadGroupRoleResolver(adSourceId: string): Promise<AdGroupRoleResolver> {
        const mappings = await this.adGroupRoleMappingRepo.find({
            where: [
                { adSourceId },
                { adSourceId: IsNull() },
            ],
            relations: ['role'],
            order: { groupName: 'ASC' },
        });

        const byExternalId = new Map<string, Role>();
        const byGroupName = new Map<string, Role>();
        const mappingGroupNames = new Set<string>();

        for (const mapping of mappings) {
            const role = mapping.role;
            if (!role || !role.isActive) {
                continue;
            }

            const externalId = this.normalizeGroupName(mapping.groupExternalId ?? '');
            if (externalId && !byExternalId.has(externalId)) {
                byExternalId.set(externalId, role);
            }

            const groupName = mapping.groupName?.trim();
            const key = this.normalizeGroupName(groupName ?? '');
            if (key && !byGroupName.has(key)) {
                byGroupName.set(key, role);
            }

            if (groupName) {
                mappingGroupNames.add(groupName);
            }
        }

        return {
            mappingGroupNames: [...mappingGroupNames],
            byExternalId,
            byGroupName,
        };
    }

    private resolveRolesForAdUser(adUser: AdUserEntry, groupRoleResolver: AdGroupRoleResolver): Role[] {
        const roles = new Map<string, Role>();

        for (const externalId of adUser.groupExternalIds ?? []) {
            const normalizedExternalId = this.normalizeGroupName(externalId);
            if (!normalizedExternalId) {
                continue;
            }

            const mappedRole = groupRoleResolver.byExternalId.get(normalizedExternalId);
            if (mappedRole) {
                roles.set(mappedRole.id, mappedRole);
            }
        }

        for (const groupName of adUser.groupNames ?? []) {
            const normalized = this.normalizeGroupName(groupName);
            if (!normalized) {
                continue;
            }

            const mappedRole = groupRoleResolver.byGroupName.get(normalized);
            if (mappedRole) {
                roles.set(mappedRole.id, mappedRole);
            }
        }

        return [...roles.values()];
    }

    private areIdSetsEqual(a: Set<string>, b: Set<string>): boolean {
        if (a.size !== b.size) return false;
        for (const id of a) {
            if (!b.has(id)) return false;
        }
        return true;
    }

    /**
     * Bulk-update lastSyncedAt for unchanged users in a single query.
     */
    private async bulkUpdateLastSynced(
        ids: string[],
        now: Date,
        triggeredBy?: string,
    ): Promise<void> {
        if (ids.length === 0) return;
        await this.userRepo
            .createQueryBuilder()
            .update(User)
            .set({ lastSyncedAt: now, updatedBy: triggeredBy ?? null })
            .whereInIds(ids)
            .execute();
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

    private emitProgress(data: {
        phase: string;
        message: string;
        current: number;
        total: number;
        created: number;
        updated: number;
        deactivated: number;
        skipped: number;
    }): void {
        this.usersGateway.broadcastToAll(WsEvent.AdSyncProgress, data);
    }
}
