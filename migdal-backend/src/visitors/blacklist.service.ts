import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlacklistEntry } from './entities/blacklist.entity';
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
    constructor(
        @InjectRepository(BlacklistEntry)
        private readonly repo: Repository<BlacklistEntry>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly wsGateway: UsersGateway,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto, blacklistType?: 'person' | 'vehicle'): Promise<PaginatedResult<BlacklistEntry>> {
        return paginateQuery(this.buildQuery(query, blacklistType), query.page, query.limit);
    }

    async exportToExcel(query: PaginationQueryDto, blacklistType: 'person' | 'vehicle'): Promise<Buffer> {
        const qb = this.buildQuery(query, blacklistType);
        const entries = await qb.getMany();

        const rows: Array<Record<string, unknown>> = entries.map((e) => {
            const creator = e.createdByUser
                ? `${e.createdByUser.firstName} ${e.createdByUser.lastName}`.trim()
                : '';
            const duration = e.isPermanent
                ? 'Permanent'
                : `${e.startDate ? new Date(e.startDate).toLocaleDateString('en-GB') : ''} – ${e.endDate ? new Date(e.endDate).toLocaleDateString('en-GB') : ''}`;
            const notifyNames = (e.notifyUsers ?? []).map(u => `${u.firstName} ${u.lastName}`).join(', ');

            if (blacklistType === 'person') {
                return {
                    'First Name': e.firstName ?? '',
                    'Last Name': e.lastName ?? '',
                    'ID Number': e.idNumber ?? '',
                    'Phone Number': e.phoneNumber ?? '',
                    'Reason': e.reason,
                    'Duration': duration,
                    'Blocked At': e.blockedAt,
                    'Created By': creator,
                    'Notify Users': notifyNames,
                    'Notes': e.notes ?? '',
                };
            }
            return {
                'Car Number': e.carNumber ?? '',
                'Vehicle Type': e.vehicleType ?? '',
                'Reason': e.reason,
                'Duration': duration,
                'Blocked At': e.blockedAt,
                'Created By': creator,
                'Notify Users': notifyNames,
                'Notes': e.notes ?? '',
            };
        });

        const sheetName = blacklistType === 'person' ? 'Person Blacklist' : 'Vehicle Blacklist';
        return toExcelBuffer(rows, sheetName);
    }

    private buildQuery(query: PaginationQueryDto, blacklistType?: 'person' | 'vehicle') {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.repo.createQueryBuilder('b')
            .leftJoinAndSelect('b.notifyUsers', 'nu')
            .leftJoinAndSelect('b.createdByUser', 'creator')
            .where('b.isActive = :active', { active: true });

        if (blacklistType) {
            qb.andWhere('b.blacklistType = :blacklistType', { blacklistType });
        }

        if (search) {
            qb.andWhere(
                '(b.firstName LIKE :s OR b.lastName LIKE :s OR b.idNumber LIKE :s OR b.carNumber LIKE :s OR b.reason LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            firstName: 'b.firstName',
            lastName: 'b.lastName',
            idNumber: 'b.idNumber',
            carNumber: 'b.carNumber',
            vehicleType: 'b.vehicleType',
            reason: 'b.reason',
            blockedAt: 'b.blockedAt',
            'createdByUser.firstName': 'creator.firstName',
        });

        const sortable: Record<string, string> = {
            firstName: 'b.firstName',
            lastName: 'b.lastName',
            idNumber: 'b.idNumber',
            carNumber: 'b.carNumber',
            vehicleType: 'b.vehicleType',
            reason: 'b.reason',
            blockedAt: 'b.blockedAt',
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
            blacklistType: dto.blacklistType,
            firstName: dto.firstName ?? null,
            lastName: dto.lastName ?? null,
            idNumber: dto.idNumber ?? null,
            phoneNumber: dto.phoneNumber ?? null,
            carNumber: dto.carNumber ?? null,
            vehicleType: dto.vehicleType ?? '',
            reason: dto.reason,
            isPermanent: dto.isPermanent,
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            blockedAt: new Date(),
            notes: dto.notes ?? null,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        if (dto.notifyUserIds?.length) {
            entry.notifyUsers = dto.notifyUserIds.map((id) => ({ id }) as User);
        }

        const saved = await this.repo.save(entry);

        const displayName = dto.blacklistType === 'vehicle'
            ? `vehicle ${saved.carNumber}`
            : `${saved.firstName} ${saved.lastName}`;

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'CREATE',
            entity: 'BlacklistEntry',
            entityId: saved.id,
            description: `Created blacklist entry for "${displayName}"`,
            newValue: dto.blacklistType === 'vehicle'
                ? { blacklistType: dto.blacklistType, carNumber: dto.carNumber, reason: dto.reason, isPermanent: dto.isPermanent }
                : { blacklistType: dto.blacklistType, firstName: dto.firstName, lastName: dto.lastName, idNumber: dto.idNumber, reason: dto.reason, isPermanent: dto.isPermanent },
        }).catch(() => { });

        return saved;
    }

    async update(id: string, dto: UpdateBlacklistDto, currentUserId?: string): Promise<BlacklistEntry> {
        const entry = await this.findById(id);
        const oldValue = entry.blacklistType === 'vehicle'
            ? { carNumber: entry.carNumber, reason: entry.reason, isPermanent: entry.isPermanent }
            : { firstName: entry.firstName, lastName: entry.lastName, reason: entry.reason, isPermanent: entry.isPermanent };
        const { notifyUserIds, ...rest } = dto;
        Object.assign(entry, rest, { updatedBy: currentUserId ?? null });

        if (rest.startDate !== undefined) {
            entry.startDate = rest.startDate ? new Date(rest.startDate) : null;
        }
        if (rest.endDate !== undefined) {
            entry.endDate = rest.endDate ? new Date(rest.endDate) : null;
        }

        if (notifyUserIds !== undefined) {
            entry.notifyUsers = notifyUserIds.map((uid) => ({ id: uid }) as User);
        }

        const saved = await this.repo.save(entry);

        const displayName = saved.blacklistType === 'vehicle'
            ? `vehicle ${saved.carNumber}`
            : `${saved.firstName} ${saved.lastName}`;

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

        const displayName = entry.blacklistType === 'vehicle'
            ? `vehicle ${entry.carNumber}`
            : `${entry.firstName} ${entry.lastName}`;

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'DELETE',
            entity: 'BlacklistEntry',
            entityId: id,
            description: `Deleted blacklist entry for "${displayName}"`,
        }).catch(() => { });
    }

    /**
     * Check if a blacklist entry is currently active (within date range or permanent).
     */
    isEntryActive(entry: BlacklistEntry): boolean {
        if (!entry.isActive) return false;
        if (entry.isPermanent) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = entry.startDate ? new Date(entry.startDate) : null;
        const end = entry.endDate ? new Date(entry.endDate) : null;
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);
        if (start && today < start) return false;
        if (end && today > end) return false;
        return true;
    }

    /**
     * Check if a person is currently blacklisted by idNumber.
     * Returns a clean response for frontend consumption.
     */
    async checkBlacklistStatus(idNumber: string): Promise<{ isBlacklisted: boolean; blacklistId?: string; reason?: string }> {
        const activeEntries = await this.findActiveByIdNumber(idNumber);
        if (activeEntries.length > 0) {
            const entry = activeEntries[0];
            return { isBlacklisted: true, blacklistId: entry.id, reason: entry.reason };
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
            where: unique.map((id) => ({ idNumber: id, isActive: true, blacklistType: 'person' as const })),
            relations: ['notifyUsers'],
        });

        const activeEntries = entries.filter((e) => this.isEntryActive(e));
        const byId = new Map<string, BlacklistEntry>();
        for (const e of activeEntries) {
            if (e.idNumber && !byId.has(e.idNumber)) {
                byId.set(e.idNumber, e);
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
     * Batch check vehicle blacklist status for multiple car numbers.
     */
    async checkVehicleBlacklistStatusBatch(
        carNumbers: string[],
    ): Promise<Map<string, { isBlacklisted: boolean; reason?: string }>> {
        const result = new Map<string, { isBlacklisted: boolean; reason?: string }>();
        if (!carNumbers.length) return result;

        const unique = [...new Set(carNumbers)];
        const entries = await this.repo.find({
            where: unique.map((cn) => ({ carNumber: cn, isActive: true, blacklistType: 'vehicle' as const })),
            relations: ['notifyUsers'],
        });

        const activeEntries = entries.filter((e) => this.isEntryActive(e));
        const byCar = new Map<string, BlacklistEntry>();
        for (const e of activeEntries) {
            if (e.carNumber && !byCar.has(e.carNumber)) {
                byCar.set(e.carNumber, e);
            }
        }

        for (const cn of unique) {
            const entry = byCar.get(cn);
            result.set(cn, entry
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
        const entries = await this.repo.find({
            where: { idNumber, isActive: true, blacklistType: 'person' },
            relations: ['notifyUsers'],
        });
        return entries.filter((e) => this.isEntryActive(e));
    }

    /**
     * Find all active blacklist entries matching a visitor by name.
     */
    async findActiveByName(firstName: string, lastName: string): Promise<BlacklistEntry[]> {
        const entries = await this.repo.find({
            where: { firstName, lastName, isActive: true, blacklistType: 'person' },
            relations: ['notifyUsers'],
        });
        return entries.filter((e) => this.isEntryActive(e));
    }

    /**
     * Check if a vehicle is currently blacklisted by car number.
     */
    async checkVehicleBlacklistStatus(carNumber: string): Promise<{ isBlacklisted: boolean; blacklistId?: string; reason?: string }> {
        const activeEntries = await this.findActiveByCarNumber(carNumber);
        if (activeEntries.length > 0) {
            const entry = activeEntries[0];
            return { isBlacklisted: true, blacklistId: entry.id, reason: entry.reason };
        }
        return { isBlacklisted: false };
    }

    /**
     * Find all active blacklist entries matching a vehicle by car number.
     */
    async findActiveByCarNumber(carNumber: string): Promise<BlacklistEntry[]> {
        const entries = await this.repo.find({
            where: { carNumber, isActive: true, blacklistType: 'vehicle' },
            relations: ['notifyUsers'],
        });
        return entries.filter((e) => this.isEntryActive(e));
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
}
