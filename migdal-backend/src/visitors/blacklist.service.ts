import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlacklistEntry } from './entities/blacklist.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { BlacklistOverrideStatus } from './enums/blacklist-override-status.enum';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { VisitorStatus } from './enums/visitor-status.enum';
import { CreateBlacklistDto } from './dto/create-blacklist.dto';
import { UpdateBlacklistDto } from './dto/update-blacklist.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../common/utils/paginate.util';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { toExcelBuffer } from '../common/utils/excel.util';
import { User } from '../users/entities/user.entity';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BlacklistService {
    private readonly logger = new Logger(BlacklistService.name);

    constructor(
        @InjectRepository(BlacklistEntry)
        private readonly repo: Repository<BlacklistEntry>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(VisitVisitor)
        private readonly visitVisitorRepo: Repository<VisitVisitor>,
        @InjectRepository(BlacklistOverrideRequest)
        private readonly overrideRepo: Repository<BlacklistOverrideRequest>,
        private readonly wsGateway: UsersGateway,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto): Promise<PaginatedResult<BlacklistEntry>> {
        return paginateQuery(this.buildQuery(query), query.page, query.limit);
    }

    async exportToExcel(query: PaginationQueryDto): Promise<Buffer> {
        const qb = this.buildQuery(query);
        const entries = await qb.getMany();

        const rows: Array<Record<string, unknown>> = entries.map((e) => {
            const creator = e.createdByUser
                ? `${e.createdByUser.firstName} ${e.createdByUser.lastName}`.trim()
                : '';
            const notifyNames = (e.notifyUsers ?? []).map(u => `${u.firstName} ${u.lastName}`).join(', ');

            return {
                'First Name': e.firstName ?? '',
                'Last Name': e.lastName ?? '',
                'ID Number': e.idNumber ?? '',
                'Phone Number': e.phoneNumber ?? '',
                'Reason': e.reason,
                'Blocked At': e.blockedAt,
                'Blocked Until': e.blockedUntil ?? '',
                'Created By': creator,
                'Notify Users': notifyNames,
                'Notes': e.notes ?? '',
            };
        });

        return toExcelBuffer(rows, 'Blacklist');
    }

    private buildQuery(query: PaginationQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.repo.createQueryBuilder('b')
            .leftJoinAndSelect('b.notifyUsers', 'nu')
            .leftJoinAndSelect('b.createdByUser', 'creator')
            .where('b.isActive = :active', { active: true });

        if (search) {
            qb.andWhere(
                '(b.firstName LIKE :s OR b.lastName LIKE :s OR b.idNumber LIKE :s OR b.reason LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            firstName: 'b.firstName',
            lastName: 'b.lastName',
            idNumber: 'b.idNumber',
            reason: 'b.reason',
            blockedAt: 'b.blockedAt',
            blockedUntil: 'b.blockedUntil',
            'createdByUser.firstName': 'creator.firstName',
        });

        const sortable: Record<string, string> = {
            firstName: 'b.firstName',
            lastName: 'b.lastName',
            idNumber: 'b.idNumber',
            reason: 'b.reason',
            blockedAt: 'b.blockedAt',
            blockedUntil: 'b.blockedUntil',
            createdAt: 'b.createdAt',
            'createdByUser.firstName': 'creator.firstName',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'b.blockedAt', sortOrder ?? 'DESC');

        return qb;
    }

    async findById(id: string): Promise<BlacklistEntry> {
        const entry = await this.repo.findOne({
            where: { id, isActive: true },
            relations: ['notifyUsers'],
        });
        if (!entry) throw new NotFoundException('Blacklist entry not found');
        return entry;
    }

    async create(dto: CreateBlacklistDto, currentUserId?: string): Promise<BlacklistEntry> {
        const entry = this.repo.create({
            firstName: dto.firstName,
            lastName: dto.lastName,
            idNumber: dto.idNumber,
            phoneNumber: dto.phoneNumber ?? null,
            reason: dto.reason,
            blockedAt: new Date(),
            blockedUntil: null,
            notes: dto.notes ?? null,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        if (dto.notifyUserIds?.length) {
            entry.notifyUsers = dto.notifyUserIds.map((id) => ({ id }) as User);
        }

        const saved = await this.repo.save(entry);

        const displayName = `${saved.firstName} ${saved.lastName}`;

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'CREATE',
            entity: 'BlacklistEntry',
            entityId: saved.id,
            description: `Created blacklist entry for "${displayName}"`,
            newValue: { firstName: dto.firstName, lastName: dto.lastName, idNumber: dto.idNumber, reason: dto.reason },
        }).catch(() => { });

        // Block existing active visit-visitors matching this person
        this.blockExistingVisitVisitors(saved, currentUserId).catch((err) => {
            this.logger.error(`Failed to block existing visit-visitors for blacklist entry ${saved.id}: ${err.message}`, err.stack);
        });

        return saved;
    }

    async update(id: string, dto: UpdateBlacklistDto, currentUserId?: string): Promise<BlacklistEntry> {
        const entry = await this.findById(id);
        const oldValue = { firstName: entry.firstName, lastName: entry.lastName, reason: entry.reason };
        const { notifyUserIds, ...rest } = dto;
        Object.assign(entry, rest, { updatedBy: currentUserId ?? null });

        if (notifyUserIds !== undefined) {
            entry.notifyUsers = notifyUserIds.map((uid) => ({ id: uid }) as User);
        }

        const saved = await this.repo.save(entry);

        const displayName = `${saved.firstName} ${saved.lastName}`;

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'UPDATE',
            entity: 'BlacklistEntry',
            entityId: id,
            description: `Updated blacklist entry for "${displayName}"`,
            oldValue,
            newValue: rest,
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const entry = await this.findById(id);
        entry.isActive = false;
        entry.updatedBy = currentUserId ?? null;
        await this.repo.save(entry);

        const displayName = `${entry.firstName} ${entry.lastName}`;

        // Cancel any pending override requests linked to this blacklist entry
        await this.cancelPendingOverrideRequests(id, currentUserId);

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'DELETE',
            entity: 'BlacklistEntry',
            entityId: id,
            description: `Deleted blacklist entry for "${displayName}"`,
        }).catch(() => { });
    }

    private async cancelPendingOverrideRequests(blacklistId: string, currentUserId?: string): Promise<void> {
        const pendingRequests = await this.overrideRepo.find({
            where: {
                blacklistId,
                status: BlacklistOverrideStatus.Pending,
                isActive: true,
            },
        });

        if (!pendingRequests.length) return;

        for (const req of pendingRequests) {
            req.status = BlacklistOverrideStatus.Cancelled;
            req.reviewedByUserId = currentUserId ?? null;
            req.reviewedAt = new Date();
            req.reviewNote = 'Auto-cancelled: blacklist entry removed';
            req.updatedBy = currentUserId ?? null;
        }

        await this.overrideRepo.save(pendingRequests);

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'CANCEL_OVERRIDE_REQUESTS',
            entity: 'BlacklistOverrideRequest',
            entityId: blacklistId,
            description: `Auto-cancelled ${pendingRequests.length} pending override request(s) for removed blacklist entry`,
        }).catch(() => { });
    }

    async restore(id: string, currentUserId?: string): Promise<BlacklistEntry> {
        const entry = await this.repo.findOne({
            where: { id },
            relations: ['notifyUsers'],
        });
        if (!entry) throw new NotFoundException('Blacklist entry not found');
        if (entry.isActive) return entry;

        entry.isActive = true;
        entry.blockedAt = new Date();
        entry.updatedBy = currentUserId ?? null;
        const saved = await this.repo.save(entry);

        const displayName = `${saved.firstName} ${saved.lastName}`;

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'RESTORE',
            entity: 'BlacklistEntry',
            entityId: id,
            description: `Restored blacklist entry for "${displayName}"`,
        }).catch(() => { });

        // Re-block existing active visit-visitors matching this person
        this.blockExistingVisitVisitors(saved, currentUserId).catch((err) => {
            this.logger.error(`Failed to block existing visit-visitors for restored blacklist entry ${saved.id}: ${err.message}`, err.stack);
        });

        return saved;
    }

    /**
     * Check if a blacklist entry is currently active.
     * An entry is inactive if isActive is false or if blockedUntil has passed.
     */
    isEntryActive(entry: BlacklistEntry): boolean {
        if (!entry.isActive) return false;
        if (entry.blockedUntil && entry.blockedUntil <= new Date()) return false;
        return true;
    }

    /**
     * Deactivate all blacklist entries whose blockedUntil date has passed.
     * Returns the number of entries that were deactivated.
     */
    async removeExpired(): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update(BlacklistEntry)
            .set({ isActive: false })
            .where('isActive = :active', { active: true })
            .andWhere('blockedUntil IS NOT NULL')
            .andWhere('blockedUntil <= :now', { now: new Date() })
            .execute();

        return result.affected ?? 0;
    }

    /**
     * Check if a person is currently blacklisted by idNumber.
     * Returns a clean response for frontend consumption.
     */
    async checkBlacklistStatus(idNumber: string): Promise<{ isBlacklisted: boolean; blacklistId?: string; reason?: string; blockedUntil?: Date | null }> {
        const activeEntries = await this.findActiveByIdNumber(idNumber);
        const now = new Date();
        const current = activeEntries.find(e => !e.blockedUntil || e.blockedUntil > now);
        if (current) {
            return { isBlacklisted: true, blacklistId: current.id, reason: current.reason, blockedUntil: current.blockedUntil };
        }
        return { isBlacklisted: false };
    }

    /**
     * Batch check blacklist status for multiple person IDs in a single query.
     * Returns a map of personId → { isBlacklisted, reason? }.
     */
    async checkBlacklistStatusBatch(
        idNumbers: string[],
    ): Promise<Map<string, { isBlacklisted: boolean; reason?: string }>> {
        const result = new Map<string, { isBlacklisted: boolean; reason?: string }>();
        if (!idNumbers.length) return result;

        const unique = [...new Set(idNumbers)];
        const entries = await this.repo.find({
            where: unique.map((id) => ({ idNumber: id, isActive: true })),
            relations: ['notifyUsers'],
        });

        const byId = new Map<string, BlacklistEntry>();
        const now = new Date();
        for (const e of entries) {
            if (e.idNumber && !byId.has(e.idNumber)) {
                if (!e.blockedUntil || e.blockedUntil > now) {
                    byId.set(e.idNumber, e);
                }
            }
        }

        for (const id of unique) {
            const entry = byId.get(id);
            result.set(id, entry
                ? { isBlacklisted: true, reason: entry.reason }
                : { isBlacklisted: false },
            );
        }
        return result;
    }

    /**
     * Find all active blacklist entries matching a visitor by idNumber.
     * Returns entries with notifyUsers loaded.
     */
    async findActiveByIdNumber(idNumber: string): Promise<BlacklistEntry[]> {
        return this.repo.find({
            where: { idNumber, isActive: true },
            relations: ['notifyUsers'],
        });
    }

    /**
     * Find all active blacklist entries matching a visitor by name.
     */
    async findActiveByName(firstName: string, lastName: string): Promise<BlacklistEntry[]> {
        return this.repo.find({
            where: { firstName, lastName, isActive: true },
            relations: ['notifyUsers'],
        });
    }

    /**
     * Send notifications for blacklisted person arrival.
     */
    notifyBlacklistArrival(entry: BlacklistEntry, visitorName: string): void {
        if (!entry.notifyUsers?.length) return;
        for (const user of entry.notifyUsers) {
            this.wsGateway.broadcastToRoom(`user:${user.id}`, 'blacklist:arrival', {
                blacklistEntryId: entry.id,
                visitorName,
                reason: entry.reason,
                message: `Blacklisted person "${visitorName}" has arrived at the site.`,
            });
        }
    }

    /**
     * When a person is added to the blacklist, find all their active visit-visitors
     * in future/current visits and create pending blacklist override requests.
     * Visitors who are already CheckedIn are NOT blocked — instead an alert is sent.
     */
    private async blockExistingVisitVisitors(blacklistEntry: BlacklistEntry, currentUserId?: string): Promise<void> {
        if (!blacklistEntry.idNumber) return;

        const now = new Date();
        const affectedVvs = await this.visitVisitorRepo
            .createQueryBuilder('vv')
            .innerJoin('vv.visitor', 'visitor')
            .innerJoin('vv.visit', 'visit')
            .leftJoinAndSelect('vv.status', 'status')
            .leftJoin(
                BlacklistOverrideRequest,
                'existing',
                'existing.visitVisitorId = vv.id AND existing.isActive = :active',
                { active: true },
            )
            .where('visitor.personId = :personId', { personId: blacklistEntry.idNumber })
            .andWhere('vv.isActive = :active', { active: true })
            .andWhere('visit.isActive = :active', { active: true })
            .andWhere('(visit.plannedEndTimeUtc >= :now OR visit.plannedEndTimeUtc IS NULL)', { now })
            .andWhere('existing.id IS NULL')
            .getMany();

        if (!affectedVvs.length) return;

        // Separate visitors by their current state:
        // - Already on premises (arrived / checked-in): send alert
        // - Not yet arrived (pending): create override request requiring approval
        // - Already left (checked-out): skip
        const onPremisesVvs = affectedVvs.filter(
            (vv) => vv.status?.currentStatus === VisitorStatus.CheckedIn
                || vv.status?.currentStatus === VisitorStatus.Arrived,
        );
        const blockableVvs = affectedVvs.filter(
            (vv) => !vv.status || vv.status.currentStatus === VisitorStatus.Pending,
        );

        // Block visitors who haven't entered yet
        if (blockableVvs.length) {
            const overrides = blockableVvs.map((vv) =>
                this.overrideRepo.create({
                    visitVisitorId: vv.id,
                    blacklistId: blacklistEntry.id,
                    blacklistReason: blacklistEntry.reason,
                    status: BlacklistOverrideStatus.Pending,
                    createdBy: currentUserId ?? null,
                }),
            );

            await this.overrideRepo.save(overrides);
        }

        // Alert about visitors already on premises (arrived or checked-in)
        if (onPremisesVvs.length) {
            this.wsGateway.broadcastToAll('blacklist:active-visitor-alert', {
                blacklistEntryId: blacklistEntry.id,
                personName: `${blacklistEntry.firstName} ${blacklistEntry.lastName}`,
                idNumber: blacklistEntry.idNumber,
                reason: blacklistEntry.reason,
                visitVisitorIds: onPremisesVvs.map((vv) => vv.id),
                count: onPremisesVvs.length,
            });
        }

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'BLACKLIST_BLOCK_VISITS',
            entity: 'BlacklistOverrideRequest',
            entityId: blacklistEntry.id,
            description: `Blocked ${blockableVvs.length} visit-visitor(s), alerted ${onPremisesVvs.length} on-premises visitor(s) for blacklisted person "${blacklistEntry.firstName} ${blacklistEntry.lastName}"`,
        }).catch(() => { });
    }
}
