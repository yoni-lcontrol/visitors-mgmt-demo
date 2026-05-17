import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../common/utils/paginate.util';
import { toExcelBuffer } from '../common/utils/excel.util';
import { SyslogService } from './syslog.service';

const BUSINESS_TZ = 'Asia/Jerusalem';

/** Convert a date-only string (YYYY-MM-DD) to start-of-day UTC in the business timezone */
function toStartOfDayUtc(dateStr: string): string {
    // If already a full ISO timestamp, use as-is
    if (dateStr.includes('T')) return dateStr;
    // Build an Intl formatter that resolves the UTC offset for the business TZ
    const local = new Date(`${dateStr}T00:00:00`);
    const utc = dateToUtcForTz(local, BUSINESS_TZ);
    return utc.toISOString();
}

/** Convert a date-only string (YYYY-MM-DD) to end-of-day UTC in the business timezone */
function toEndOfDayUtc(dateStr: string): string {
    if (dateStr.includes('T')) return dateStr;
    const local = new Date(`${dateStr}T23:59:59.999`);
    const utc = dateToUtcForTz(local, BUSINESS_TZ);
    return utc.toISOString();
}

/** Given a "wall clock" Date and an IANA timezone, return the equivalent UTC Date */
function dateToUtcForTz(wallClock: Date, tz: string): Date {
    // Format the same instant in the target TZ to find the offset
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, fractionalSecondDigits: 3,
    } as Intl.DateTimeFormatOptions);

    // We need the inverse: given wall-clock in TZ, what is UTC?
    // Use a reference point to compute the TZ offset
    const refUtc = new Date(Date.UTC(
        wallClock.getFullYear(), wallClock.getMonth(), wallClock.getDate(),
        wallClock.getHours(), wallClock.getMinutes(), wallClock.getSeconds(), wallClock.getMilliseconds(),
    ));
    const parts = formatter.formatToParts(refUtc);
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);
    const tzTime = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
    const offsetMs = tzTime.getTime() - refUtc.getTime();
    // wallClock - offset = UTC
    return new Date(refUtc.getTime() - offsetMs);
}

export interface CreateAuditLogParams {
    userId?: string | null;
    module?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    description?: string | null;
    performedByEmail?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: unknown;
}

const ALLOWED_SORT_FIELDS: Record<string, string> = {
    createdAt: 'al.createdAt',
    module: 'al.module',
    action: 'al.action',
    entity: 'al.entity',
    userId: 'al.userId',
};

@Injectable()
export class AuditService {
    private readonly logger = new Logger('AuditEvent');

    constructor(
        @InjectRepository(AuditLog)
        private readonly auditRepo: Repository<AuditLog>,
        private readonly syslogService: SyslogService,
    ) { }

    async log(params: CreateAuditLogParams): Promise<void> {
        this.logger.log({
            category: 'audit',
            userId: params.userId ?? null,
            module: params.module ?? null,
            action: params.action,
            entity: params.entity,
            entityId: params.entityId ?? null,
            description: params.description ?? null,
            ipAddress: params.ipAddress ?? null,
        });

        const syslogMessage = {
            category: 'audit',
            userId: params.userId ?? null,
            module: params.module ?? null,
            action: params.action,
            entity: params.entity,
            entityId: params.entityId ?? null,
            description: params.description ?? null,
            ipAddress: params.ipAddress ?? null,
            timestamp: new Date().toISOString(),
        };

        const sent = await this.syslogService.send(syslogMessage);

        const entry = this.auditRepo.create({
            userId: params.userId ?? null,
            module: params.module ?? null,
            action: params.action,
            entity: params.entity,
            entityId: params.entityId ?? null,
            description: params.description ?? null,
            performedByEmail: params.performedByEmail ?? null,
            oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
            newValue: params.newValue ? JSON.stringify(params.newValue) : null,
            ipAddress: params.ipAddress ?? null,
            userAgent: params.userAgent ?? null,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            syslogSentAt: sent ? new Date() : null,
        });
        await this.auditRepo.save(entry);
    }

    async findAll(query: AuditQueryDto): Promise<PaginatedResult<AuditLog>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    async exportToExcel(query: AuditQueryDto): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query);
        const items = await qb.getMany();
        const rows = items.map((log) => ({
            timestamp: log.createdAt ? new Date(log.createdAt).toLocaleString('en-GB') : '',
            user: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
            email: log.performedByEmail || '',
            module: log.module || '',
            action: log.action,
            entity: log.entity,
            entityId: log.entityId || '',
            description: log.description || '',
            ipAddress: log.ipAddress || '',
        }));
        return toExcelBuffer(rows, 'AuditLogs');
    }

    private buildFindAllQuery(query: AuditQueryDto): SelectQueryBuilder<AuditLog> {
        const { search, sortBy, sortOrder } = query;

        const qb = this.auditRepo
            .createQueryBuilder('al')
            .leftJoinAndSelect('al.user', 'user');

        if (query.module) {
            qb.andWhere('al.module = :module', { module: query.module });
        }
        if (query.entity) {
            qb.andWhere('al.entity = :entity', { entity: query.entity });
        }
        if (query.action) {
            qb.andWhere('al.action = :action', { action: query.action });
        }
        if (query.userId) {
            qb.andWhere('al.userId = :userId', { userId: query.userId });
        }
        if (query.dateFrom) {
            qb.andWhere('al.createdAt >= :dateFrom', { dateFrom: toStartOfDayUtc(query.dateFrom) });
        }
        if (query.dateTo) {
            qb.andWhere('al.createdAt <= :dateTo', { dateTo: toEndOfDayUtc(query.dateTo) });
        }
        if (search) {
            qb.andWhere(
                '(al.entity LIKE :s OR al.action LIKE :s OR al.description LIKE :s OR al.module LIKE :s)',
                { s: `%${search}%` },
            );
        }

        const safeSortColumn = sortBy && ALLOWED_SORT_FIELDS[sortBy]
            ? ALLOWED_SORT_FIELDS[sortBy]
            : 'al.createdAt';
        qb.orderBy(safeSortColumn, sortOrder ?? 'DESC');

        return qb;
    }

    async findOne(id: string): Promise<AuditLog> {
        const entry = await this.auditRepo.findOne({
            where: { id },
            relations: ['user'],
        });
        if (!entry) {
            throw new NotFoundException('Audit log entry not found');
        }
        return entry;
    }
}
