import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { EntranceExitLogQueryDto } from './dto/entrance-exit-log-query.dto';
import { toExcelBuffer } from '../common/utils/excel.util';
import { VisitorStatus } from './enums/visitor-status.enum';

export interface EntranceExitLogItem {
    visitVisitorId: string;
    visitorId: string;
    firstName: string;
    lastName: string;
    personId: string;
    phone: string | null;
    email: string | null;
    currentStatus: number;
    arrivedAtUtc: Date | null;
    checkedInAtUtc: Date | null;
    checkedOutAtUtc: Date | null;
    lastEventTimeUtc: Date | null;
}

@Injectable()
export class VisitorLogService {
    constructor(
        @InjectRepository(VisitVisitorStatus)
        private readonly statusRepo: Repository<VisitVisitorStatus>,
    ) { }

    /* ── Entrance / Exit Logs ── */

    async findEntranceExitLogs(query: EntranceExitLogQueryDto): Promise<PaginatedResult<EntranceExitLogItem>> {
        const { page, limit } = query;
        const qb = this.buildEntranceExitQuery(query);

        const total = await qb.getCount();
        const raw = await qb.skip((page - 1) * limit).take(limit).getRawMany();

        const items = this.mapEntranceExitRows(raw);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async exportEntranceExitLogs(query: EntranceExitLogQueryDto): Promise<Buffer> {
        const qb = this.buildEntranceExitQuery(query);
        const raw = await qb.getRawMany();
        const items = this.mapEntranceExitRows(raw);

        const statusLabel = (s: number): string => {
            switch (s) {
                case VisitorStatus.Arrived: return 'Arrived';
                case VisitorStatus.CheckedIn: return 'Checked In';
                case VisitorStatus.CheckedOut: return 'Checked Out';
                default: return 'Pending';
            }
        };

        const rows = items.map((item) => ({
            'First Name': item.firstName,
            'Last Name': item.lastName,
            'Person ID': item.personId,
            'Phone': item.phone ?? '',
            'Email': item.email ?? '',
            'Status': statusLabel(item.currentStatus),
            'Arrived At': item.arrivedAtUtc ?? '',
            'Checked In At': item.checkedInAtUtc ?? '',
            'Checked Out At': item.checkedOutAtUtc ?? '',
            'Last Event': item.lastEventTimeUtc ?? '',
        }));
        return toExcelBuffer(rows, 'Entrance Exit Logs');
    }

    private buildEntranceExitQuery(query: EntranceExitLogQueryDto) {
        const { dateFrom, dateTo, status, personId, firstName, lastName, phone, email, search, sortBy, sortOrder } = query;

        const qb = this.statusRepo.createQueryBuilder('s')
            .innerJoin('s.visitVisitor', 'vv')
            .innerJoin('vv.visitor', 'vis')
            .select([
                's.visitVisitorId AS visitVisitorId',
                's.visitorId AS visitorId',
                'vis.firstName AS firstName',
                'vis.lastName AS lastName',
                'vis.personId AS personId',
                'vis.phone AS phone',
                'vis.email AS email',
                's.currentStatus AS currentStatus',
                's.arrivedAtUtc AS arrivedAtUtc',
                's.checkedInAtUtc AS checkedInAtUtc',
                's.checkedOutAtUtc AS checkedOutAtUtc',
                's.lastEventTimeUtc AS lastEventTimeUtc',
            ])
            // Only include visitors that have at least arrived
            .where('s.currentStatus > :pending', { pending: VisitorStatus.Pending });

        if (dateFrom) {
            qb.andWhere('s.lastEventTimeUtc >= :dateFrom', { dateFrom });
        }
        if (dateTo) {
            const endOfDay = new Date(dateTo);
            endOfDay.setUTCHours(23, 59, 59, 999);
            qb.andWhere('s.lastEventTimeUtc <= :dateTo', { dateTo: endOfDay.toISOString() });
        }
        if (status) {
            const statusMap: Record<string, number> = {
                'arrived': VisitorStatus.Arrived,
                'checked-in': VisitorStatus.CheckedIn,
                'checked-out': VisitorStatus.CheckedOut,
            };
            const statusValue = statusMap[status];
            if (statusValue !== undefined) {
                qb.andWhere('s.currentStatus = :statusVal', { statusVal: statusValue });
            }
        }
        if (personId) {
            qb.andWhere('vis.personId LIKE :personId', { personId: `%${personId}%` });
        }
        if (firstName) {
            qb.andWhere('vis.firstName LIKE :firstName', { firstName: `%${firstName}%` });
        }
        if (lastName) {
            qb.andWhere('vis.lastName LIKE :lastName', { lastName: `%${lastName}%` });
        }
        if (phone) {
            qb.andWhere('vis.phone LIKE :phone', { phone: `%${phone}%` });
        }
        if (email) {
            qb.andWhere('vis.email LIKE :email', { email: `%${email}%` });
        }
        if (search) {
            qb.andWhere(
                '(vis.firstName LIKE :s OR vis.lastName LIKE :s OR vis.personId LIKE :s OR vis.phone LIKE :s OR vis.email LIKE :s)',
                { s: `%${search}%` },
            );
        }

        const sortable: Record<string, string> = {
            checkedInAtUtc: 's.checkedInAtUtc',
            checkedOutAtUtc: 's.checkedOutAtUtc',
            arrivedAtUtc: 's.arrivedAtUtc',
            lastEventTimeUtc: 's.lastEventTimeUtc',
            firstName: 'vis.firstName',
            lastName: 'vis.lastName',
            personId: 'vis.personId',
            currentStatus: 's.currentStatus',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 's.lastEventTimeUtc', sortOrder ?? 'DESC');

        return qb;
    }

    private mapEntranceExitRows(raw: any[]): EntranceExitLogItem[] {
        return raw.map((r) => ({
            visitVisitorId: r.visitVisitorId,
            visitorId: r.visitorId,
            firstName: r.firstName,
            lastName: r.lastName,
            personId: r.personId,
            phone: r.phone ?? null,
            email: r.email ?? null,
            currentStatus: typeof r.currentStatus === 'string' ? parseInt(r.currentStatus, 10) : r.currentStatus,
            arrivedAtUtc: r.arrivedAtUtc ?? null,
            checkedInAtUtc: r.checkedInAtUtc ?? null,
            checkedOutAtUtc: r.checkedOutAtUtc ?? null,
            lastEventTimeUtc: r.lastEventTimeUtc ?? null,
        }));
    }
}
