import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Visit } from './entities/visit.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitorAccessLog } from './entities/visitor-access-log.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { Visitor } from './entities/visitor.entity';
import { OnSiteQueryDto } from './dto/on-site-query.dto';
import { CreateVisitorAccessLogDto } from './dto/create-visitor-access-log.dto';
import { VisitorAccessEventType } from './enums/visitor-access-event-type.enum';
import { VisitorStatus } from './enums/visitor-status.enum';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { BlacklistService } from './blacklist.service';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { AuditService } from '../audit/audit.service';
import { resolveVisitRequester, buildSmsData } from './visit.utils';
import { getDayBoundsUtc } from '../common/utils/date.util';
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { BlacklistOverrideStatus } from './enums/blacklist-override-status.enum';

@Injectable()
export class VisitStatusService {
    constructor(
        @InjectRepository(Visit)
        private readonly visitRepo: Repository<Visit>,
        @InjectRepository(VisitVisitor)
        private readonly visitVisitorRepo: Repository<VisitVisitor>,
        @InjectRepository(VisitorAccessLog)
        private readonly accessLogRepo: Repository<VisitorAccessLog>,
        @InjectRepository(VisitVisitorStatus)
        private readonly statusRepo: Repository<VisitVisitorStatus>,
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
        private readonly dataSource: DataSource,
        private readonly wsGateway: UsersGateway,
        private readonly blacklistService: BlacklistService,
        private readonly smsNotification: SmsNotificationService,
        private readonly emailNotification: EmailNotificationService,
        private readonly auditService: AuditService,
    ) { }

    // ── On Site ──

    async findOnSiteVisitors(query: OnSiteQueryDto): Promise<{
        items: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        summary: { onSite: number; arrived: number; checkedIn: number; blacklisted: number };
    }> {
        const { page, limit, search, siteId, status, sortBy, sortOrder } = query;

        const targetDate = query.date ? new Date(query.date + 'T00:00:00') : new Date();
        const { dayStart, dayEnd } = getDayBoundsUtc(targetDate);

        const statuses: number[] = [];
        if (!status || status === 'arrived') statuses.push(VisitorStatus.Arrived);
        if (!status || status === 'checked-in') statuses.push(VisitorStatus.CheckedIn);

        const qb = this.statusRepo
            .createQueryBuilder('s')
            .innerJoin('s.visitVisitor', 'vv')
            .innerJoin('vv.visitor', 'vis')
            .innerJoin('vv.visit', 'v')
            .addSelect(['vv.id', 'vv.visitId', 'vv.visitorId', 'vv.notes'])
            .addSelect(['vis.id', 'vis.firstName', 'vis.lastName', 'vis.email', 'vis.phone', 'vis.personId', 'vis.carNumber', 'vis.vehicleType'])
            .addSelect(['v.id', 'v.title', 'v.plannedStartTimeUtc', 'v.plannedEndTimeUtc', 'v.siteId', 'v.visitRequesterFirstName', 'v.visitRequesterLastName', 'v.visitRequesterPhone', 'v.visitRequesterEmail', 'v.visitRequesterUserId', 'v.purposeOfVisit'])
            .leftJoin('v.visitRequesterUser', 'reqUser')
            .addSelect(['reqUser.id', 'reqUser.firstName', 'reqUser.lastName', 'reqUser.phone', 'reqUser.email'])
            .where('s.currentStatus IN (:...statuses)', { statuses })
            .andWhere('vv.isActive = :active', { active: true })
            .andWhere('v.isActive = :vActive', { vActive: true })
            .andWhere('v.plannedStartTimeUtc < :dayEnd', { dayEnd })
            .andWhere(
                '(v.plannedStartTimeUtc >= :dayStart OR (v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc >= :dayStartBound))',
                { dayStart, dayStartBound: dayStart },
            );

        if (siteId) {
            qb.andWhere('v.siteId = :siteId', { siteId });
        }

        if (search) {
            qb.andWhere(
                '(vis.firstName LIKE :s OR vis.lastName LIKE :s OR v.title LIKE :s OR vis.personId LIKE :s)',
                { s: `%${search}%` },
            );
        }

        const sortMap: Record<string, string> = {
            visitorName: 'vis.firstName',
            visitTitle: 'v.title',
            arrivedAt: 's.arrivedAtUtc',
            status: 's.currentStatus',
        };
        const sortColumn = sortBy ? sortMap[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 's.lastEventTimeUtc', sortOrder ?? 'DESC');

        const total = await qb.getCount();
        const records = await qb.skip((page - 1) * limit).take(limit).getMany();

        const personIds = [...new Set(records.map((r) => r.visitVisitor?.visitor?.personId).filter(Boolean))];
        const blacklistMap = await this.blacklistService.checkBlacklistStatusBatch(personIds as string[]);

        const summaryQb = this.statusRepo
            .createQueryBuilder('s2')
            .select('s2.currentStatus', 'currentStatus')
            .addSelect('COUNT(*)', 'cnt')
            .innerJoin('s2.visitVisitor', 'vv2')
            .innerJoin('vv2.visit', 'v2')
            .where('s2.currentStatus IN (:...statuses)', { statuses })
            .andWhere('vv2.isActive = :active', { active: true })
            .andWhere('v2.isActive = :vActive', { vActive: true })
            .andWhere('v2.plannedStartTimeUtc < :dayEnd', { dayEnd })
            .andWhere(
                '(v2.plannedStartTimeUtc >= :dayStart OR (v2.plannedEndTimeUtc IS NOT NULL AND v2.plannedEndTimeUtc >= :dayStartBound))',
                { dayStart, dayStartBound: dayStart },
            );

        if (siteId) {
            summaryQb.andWhere('v2.siteId = :siteId', { siteId });
        }

        summaryQb.groupBy('s2.currentStatus');
        const summaryRows = await summaryQb.getRawMany();

        let arrivedCount = 0;
        let checkedInCount = 0;
        for (const row of summaryRows) {
            if (+row.currentStatus === VisitorStatus.Arrived) arrivedCount = +row.cnt;
            if (+row.currentStatus === VisitorStatus.CheckedIn) checkedInCount = +row.cnt;
        }

        let blacklistedCount = 0;

        const items = records.map((s) => {
            const vv = s.visitVisitor;
            const vis = vv?.visitor;
            const v = vv?.visit;
            const personId = vis?.personId;
            const bl = personId ? blacklistMap.get(personId) : undefined;
            const isBlacklisted = bl?.isBlacklisted ?? false;
            if (isBlacklisted) blacklistedCount++;

            const reqFromVisit = v ? resolveVisitRequester(v as Visit) : null;

            return {
                visitId: s.visitId,
                visitVisitorId: s.visitVisitorId,
                visitorId: s.visitorId,
                visitorFirstName: vis?.firstName ?? '',
                visitorLastName: vis?.lastName ?? '',
                visitorFullName: vis ? `${vis.firstName} ${vis.lastName}` : '',
                visitorPhone: vis?.phone ?? null,
                visitorEmail: vis?.email ?? null,
                visitorPersonId: vis?.personId ?? '',
                visitorCarNumber: vis?.carNumber ?? null,
                visitorVehicleType: vis?.vehicleType ?? null,
                visitTitle: v?.title ?? '',
                plannedStartTimeUtc: v?.plannedStartTimeUtc ?? null,
                plannedEndTimeUtc: v?.plannedEndTimeUtc ?? null,
                siteId: v?.siteId ?? null,
                purposeOfVisit: v?.purposeOfVisit ?? null,
                currentStatus: s.currentStatus,
                arrivedAtUtc: s.arrivedAtUtc,
                checkedInAtUtc: s.checkedInAtUtc,
                checkedOutAtUtc: s.checkedOutAtUtc,
                lastEventTimeUtc: s.lastEventTimeUtc,
                isBlacklisted,
                blacklistReason: isBlacklisted ? (bl?.reason ?? null) : null,
                visitRequesterFirstName: reqFromVisit?.firstName ?? null,
                visitRequesterLastName: reqFromVisit?.lastName ?? null,
                visitRequesterPhone: reqFromVisit?.phone ?? null,
                visitRequesterEmail: reqFromVisit?.email ?? null,
            };
        });

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            summary: {
                onSite: arrivedCount + checkedInCount,
                arrived: arrivedCount,
                checkedIn: checkedInCount,
                blacklisted: blacklistedCount,
            },
        };
    }

    // ── Access Logs (Events) ──

    async createAccessLog(dto: CreateVisitorAccessLogDto, currentUserId?: string): Promise<VisitorAccessLog> {
        const vv = await this.visitVisitorRepo.findOne({
            where: { id: dto.visitVisitorId, isActive: true },
        });
        if (!vv) throw new NotFoundException('Visit visitor not found');

        // Block status changes for visitors with pending or denied blacklist override
        // Exception: Check-Out is always allowed (need to record exit of visitor already inside)
        if (dto.eventType !== VisitorAccessEventType.CheckedOut) {
            const blockingOverride = await this.dataSource.getRepository(BlacklistOverrideRequest).findOne({
                where: [
                    { visitVisitorId: vv.id, status: BlacklistOverrideStatus.Pending, isActive: true },
                    { visitVisitorId: vv.id, status: BlacklistOverrideStatus.Denied, isActive: true },
                ],
            });
            if (blockingOverride) {
                const reason = blockingOverride.status === BlacklistOverrideStatus.Pending
                    ? 'Cannot change status for a visitor with a pending blacklist override approval'
                    : 'Cannot change status for a visitor whose blacklist override was denied';
                throw new ForbiddenException(reason);
            }
        }

        const eventTime = dto.eventTimeUtc ? new Date(dto.eventTimeUtc) : new Date();

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();

        try {
            const log = qr.manager.create(VisitorAccessLog, {
                visitVisitorId: vv.id,
                visitId: vv.visitId,
                visitorId: vv.visitorId,
                siteId: dto.siteId ?? null,
                eventType: dto.eventType,
                eventTimeUtc: eventTime,
                deviceId: dto.deviceId ?? null,
                gateId: dto.gateId ?? null,
                readerId: dto.readerId ?? null,
                source: dto.source ?? null,
                createdByUserId: currentUserId ?? null,
                notes: dto.notes ?? null,
            });
            const savedLog = await qr.manager.save(log);

            let status = await qr.manager.findOne(VisitVisitorStatus, {
                where: { visitVisitorId: vv.id },
            });

            if (!status) {
                status = qr.manager.create(VisitVisitorStatus, {
                    visitVisitorId: vv.id,
                    visitId: vv.visitId,
                    visitorId: vv.visitorId,
                    currentStatus: VisitorStatus.Pending,
                });
            }

            status.currentStatus = this.mapEventToStatus(dto.eventType);
            status.lastAccessLogId = savedLog.logId;
            status.lastEventTimeUtc = eventTime;
            status.updatedAt = new Date();

            if (dto.eventType === VisitorAccessEventType.Arrived) {
                status.arrivedAtUtc = eventTime;
            } else if (dto.eventType === VisitorAccessEventType.CheckedIn) {
                status.checkedInAtUtc = eventTime;
            } else if (dto.eventType === VisitorAccessEventType.CheckedOut) {
                status.checkedOutAtUtc = eventTime;
            }

            await qr.manager.save(status);
            await qr.commitTransaction();

            const eventNames: Record<number, string> = {
                [VisitorAccessEventType.Arrived]: 'arrived',
                [VisitorAccessEventType.CheckedIn]: 'checked-in',
                [VisitorAccessEventType.CheckedOut]: 'checked-out',
            };
            this.wsGateway.broadcastToAll(`visits:visitor:${eventNames[dto.eventType]}`, {
                visitId: vv.visitId,
                visitVisitorId: vv.id,
                visitorId: vv.visitorId,
                eventType: dto.eventType,
            });

            this.auditService.log({
                userId: currentUserId,
                module: 'visitors',
                action: 'STATUS_CHANGE',
                entity: 'VisitorAccessLog',
                entityId: String(savedLog.logId),
                description: `Visitor status changed to ${eventNames[dto.eventType] ?? dto.eventType}`,
                newValue: { visitId: vv.visitId, visitVisitorId: vv.id, eventType: dto.eventType },
            }).catch(() => { });

            if (dto.eventType === VisitorAccessEventType.Arrived) {
                const visit = await this.visitRepo.findOne({ where: { id: vv.visitId } });
                const visitor = await this.visitorRepo.findOne({ where: { id: vv.visitorId } });
                if (visit && visitor) {
                    const blResult = await this.blacklistService.checkBlacklistStatus(visitor.personId).catch(() => ({ isBlacklisted: false }));
                    const event = blResult.isBlacklisted
                        ? NotificationEvent.VisitorBlacklisted
                        : NotificationEvent.VisitorArrived;
                    this.smsNotification.triggerSms(event, buildSmsData(visit, visitor))
                        .catch(() => { });
                    this.emailNotification.triggerEmail(event, buildSmsData(visit, visitor))
                        .catch(() => { });
                }
            } else if (dto.eventType === VisitorAccessEventType.CheckedOut) {
                const visit = await this.visitRepo.findOne({ where: { id: vv.visitId } });
                const visitor = await this.visitorRepo.findOne({ where: { id: vv.visitorId } });
                if (visit && visitor) {
                    this.smsNotification.triggerSms(NotificationEvent.VisitorCheckedOut, buildSmsData(visit, visitor))
                        .catch(() => { });
                    this.emailNotification.triggerEmail(NotificationEvent.VisitorCheckedOut, buildSmsData(visit, visitor))
                        .catch(() => { });
                }
            }

            return savedLog;
        } catch (err) {
            await qr.rollbackTransaction();
            throw err;
        } finally {
            await qr.release();
        }
    }

    private mapEventToStatus(eventType: number): VisitorStatus {
        switch (eventType) {
            case VisitorAccessEventType.Arrived:
                return VisitorStatus.Arrived;
            case VisitorAccessEventType.CheckedIn:
                return VisitorStatus.CheckedIn;
            case VisitorAccessEventType.CheckedOut:
                return VisitorStatus.CheckedOut;
            default:
                return VisitorStatus.Pending;
        }
    }

    // ── Status & History queries ──

    async getVisitorStatuses(visitId: string): Promise<any[]> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        const statuses = await this.statusRepo
            .createQueryBuilder('s')
            .innerJoin('s.visitVisitor', 'vv')
            .innerJoinAndSelect('vv.visitor', 'vis')
            .where('s.visitId = :visitId', { visitId })
            .andWhere('vv.isActive = :active', { active: true })
            .getMany();

        return statuses.map((s) => ({
            visitVisitorId: s.visitVisitorId,
            visitId: s.visitId,
            visitorId: s.visitorId,
            currentStatus: s.currentStatus,
            arrivedAtUtc: s.arrivedAtUtc,
            checkedInAtUtc: s.checkedInAtUtc,
            checkedOutAtUtc: s.checkedOutAtUtc,
            lastEventTimeUtc: s.lastEventTimeUtc,
            visitor: s.visitVisitor?.visitor ? {
                id: s.visitVisitor.visitor.id,
                firstName: s.visitVisitor.visitor.firstName,
                lastName: s.visitVisitor.visitor.lastName,
                fullName: `${s.visitVisitor.visitor.firstName} ${s.visitVisitor.visitor.lastName}`,
                email: s.visitVisitor.visitor.email,
                phone: s.visitVisitor.visitor.phone,
            } : null,
        }));
    }

    async getVisitHistory(visitId: string): Promise<VisitorAccessLog[]> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        return this.accessLogRepo.find({
            where: { visitId },
            order: { eventTimeUtc: 'DESC' },
        });
    }

    async getVisitVisitorHistory(visitVisitorId: string): Promise<VisitorAccessLog[]> {
        const vv = await this.visitVisitorRepo.findOne({ where: { id: visitVisitorId } });
        if (!vv) throw new NotFoundException('Visit visitor not found');

        return this.accessLogRepo.find({
            where: { visitVisitorId },
            order: { eventTimeUtc: 'DESC' },
        });
    }

    // ── Auto Checkout ──

    async autoCheckOutExpiredVisitors(): Promise<{ checkedOut: number }> {
        const now = new Date();

        const openStatuses = await this.statusRepo
            .createQueryBuilder('s')
            .innerJoinAndSelect('s.visitVisitor', 'vv')
            .innerJoin('vv.visit', 'v')
            .where('s.currentStatus IN (:...statuses)', {
                statuses: [VisitorStatus.Arrived, VisitorStatus.CheckedIn],
            })
            .andWhere('vv.isActive = :active', { active: true })
            .andWhere('v.isActive = :vActive', { vActive: true })
            .andWhere('v.plannedEndTimeUtc IS NOT NULL')
            .andWhere('v.plannedEndTimeUtc <= :now', { now })
            .getMany();

        if (openStatuses.length === 0) {
            return { checkedOut: 0 };
        }

        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();

        try {
            for (const status of openStatuses) {
                status.currentStatus = VisitorStatus.CheckedOut;
                status.checkedOutAtUtc = now;
                status.lastEventTimeUtc = now;
                status.updatedAt = now;
                await qr.manager.save(status);
            }

            await qr.commitTransaction();
        } catch (err) {
            await qr.rollbackTransaction();
            throw err;
        } finally {
            await qr.release();
        }

        for (const status of openStatuses) {
            this.wsGateway.broadcastToAll('visits:visitor:checked-out', {
                visitId: status.visitId,
                visitVisitorId: status.visitVisitorId,
                visitorId: status.visitorId,
                eventType: VisitorAccessEventType.CheckedOut,
            });

            this.auditService.log({
                userId: null,
                module: 'visitors',
                action: 'AUTO_CHECKOUT',
                entity: 'VisitVisitorStatus',
                entityId: status.visitVisitorId,
                description: 'Visitor auto-checked-out by scheduled task (visit ended)',
                newValue: { visitId: status.visitId, visitVisitorId: status.visitVisitorId },
            }).catch(() => { });
        }

        return { checkedOut: openStatuses.length };
    }
}
