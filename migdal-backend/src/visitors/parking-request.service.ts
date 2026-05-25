import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParkingRequest } from './entities/parking-request.entity';
import { ParkingRequestStatus } from './enums/parking-request-status.enum';
import { AmadeusSyncStatus } from './enums/amadeus-sync-status.enum';
import { ParkingRequestQueryDto } from './dto/parking-request-query.dto';
import { ReviewParkingRequestDto } from './dto/review-parking-request.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { SmsTemplateData } from '../settings/sms-template-renderer.service';
import { AuditService } from '../audit/audit.service';
import { AmadeusParkingSyncService } from '../amadeus/services/amadeus-parking-sync.service';

@Injectable()
export class ParkingRequestService {
    constructor(
        @InjectRepository(ParkingRequest)
        private readonly parkingRepo: Repository<ParkingRequest>,
        private readonly smsNotification: SmsNotificationService,
        private readonly emailNotification: EmailNotificationService,
        private readonly auditService: AuditService,
        private readonly amadeusParkingSync: AmadeusParkingSyncService,
    ) {}

    async createRequest(visitVisitorId: string, autoApprove: boolean, currentUserId?: string): Promise<ParkingRequest> {
        const existing = await this.parkingRepo.findOne({ where: { visitVisitorId, isActive: true } });
        if (existing) {
            return existing;
        }

        const request = this.parkingRepo.create({
            visitVisitorId,
            status: autoApprove ? ParkingRequestStatus.Approved : ParkingRequestStatus.Pending,
            reviewedByUserId: autoApprove ? currentUserId ?? null : null,
            reviewedAt: autoApprove ? new Date() : null,
            createdBy: currentUserId ?? null,
        });
        const saved = await this.parkingRepo.save(request);

        // Sync approved parking visitor to Amadeus (fire-and-forget)
        if (autoApprove) {
            this.parkingRepo.update(saved.id, { amadeusSyncStatus: AmadeusSyncStatus.Pending }).catch(() => { });
            this.amadeusParkingSync.syncApprovedParkingVisitorToAmadeus(saved.id).catch(() => { });
        }

        return saved;
    }

    async findAll(query: ParkingRequestQueryDto): Promise<PaginatedResult<any>> {
        const { page = 1, limit = 20, status, search, sortBy, sortOrder, filters } = query;

        const qb = this.parkingRepo.createQueryBuilder('pr')
            .innerJoinAndSelect('pr.visitVisitor', 'vv')
            .innerJoinAndSelect('vv.visitor', 'vis')
            .innerJoinAndSelect('vv.visit', 'visit')
            .leftJoinAndSelect('visit.createdByUser', 'creator')
            .leftJoinAndSelect('pr.reviewedByUser', 'reviewer')
            .where('pr.isActive = :active', { active: true });

        if (status) {
            qb.andWhere('pr.status = :status', { status });
        }
        if (search) {
            qb.andWhere(
                '(vis.firstName LIKE :s OR vis.lastName LIKE :s OR vis.personId LIKE :s OR vis.carNumber LIKE :s OR visit.title LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            visitorName: 'vis.firstName',
            visitTitle: 'visit.title',
            createdBy: 'creator.firstName',
            carNumber: 'vis.carNumber',
            createdAt: 'pr.createdAt',
            reviewedBy: 'reviewer.firstName',
        });

        const sortable: Record<string, string> = {
            createdAt: 'pr.createdAt',
            status: 'pr.status',
            visitorName: 'vis.firstName',
            visitTitle: 'visit.title',
            createdBy: 'creator.firstName',
            carNumber: 'vis.carNumber',
            reviewedBy: 'reviewer.firstName',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'pr.createdAt', sortOrder ?? 'DESC');

        const total = await qb.getCount();
        const items = await qb.skip((page - 1) * limit).take(limit).getMany();

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async review(id: string, dto: ReviewParkingRequestDto, currentUserId: string): Promise<ParkingRequest> {
        const request = await this.parkingRepo.findOne({
            where: { id, isActive: true },
            relations: ['visitVisitor', 'visitVisitor.visitor', 'visitVisitor.visit', 'visitVisitor.visit.createdByUser'],
        });
        if (!request) {
            throw new NotFoundException('Parking request not found');
        }

        const previousStatus = request.status;

        request.status = dto.status;
        request.reviewedByUserId = currentUserId;
        request.reviewedAt = new Date();
        request.reviewNote = dto.reviewNote ?? null;
        request.updatedBy = currentUserId;

        const saved = await this.parkingRepo.save(request);

        const visitor = request.visitVisitor?.visitor;
        const auditAction = dto.status === ParkingRequestStatus.Approved
            ? 'PARKING_REQUEST_APPROVED'
            : 'PARKING_REQUEST_DENIED';
        const visitorName = visitor
            ? [visitor.firstName, visitor.lastName].filter(Boolean).join(' ')
            : '';
        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: auditAction,
            entity: 'ParkingRequest',
            entityId: id,
            description: `Parking request ${dto.status} for visitor ${visitorName}`.trim(),
            oldValue: { status: previousStatus },
            newValue: { status: dto.status, reviewNote: dto.reviewNote ?? null },
        }).catch(() => { });

        // Trigger parking decision notification (fire-and-forget)
        this.triggerParkingDecisionNotification(request).catch(() => { });

        // Sync approved parking visitor to Amadeus (fire-and-forget)
        if (dto.status === ParkingRequestStatus.Approved) {
            this.parkingRepo.update(saved.id, { amadeusSyncStatus: AmadeusSyncStatus.Pending }).catch(() => { });
            this.amadeusParkingSync.syncApprovedParkingVisitorToAmadeus(saved.id).catch(() => { });
        }

        // Remove rejected parking visitor from Amadeus if they exist (fire-and-forget)
        if (dto.status === ParkingRequestStatus.Denied) {
            this.amadeusParkingSync.removeRejectedParkingVisitorFromAmadeus(saved.id).catch(() => { });
        }

        return saved;
    }

    private async triggerParkingDecisionNotification(request: ParkingRequest): Promise<void> {
        const visit = request.visitVisitor?.visit;
        const visitor = request.visitVisitor?.visitor;
        if (!visit || !visitor) return;

        const requester = visit.createdByUser;
        const hostName = requester
            ? [requester.firstName, requester.lastName].filter(Boolean).join(' ')
            : '';

        const data: SmsTemplateData = {
            visit: {
                title: visit.title,
                startTime: visit.plannedStartTimeUtc?.toLocaleString('he-IL') ?? '',
                endTime: visit.plannedEndTimeUtc?.toLocaleString('he-IL') ?? '',
                hostName,
                siteName: visit.siteId ?? '',
                purposeOfVisit: visit.purposeOfVisit ?? '',
            },
            visitor: {
                firstName: visitor.firstName,
                lastName: visitor.lastName,
                personId: visitor.personId,
                phone: visitor.phone ?? '',
                carNumber: visitor.carNumber ?? '',
            },
            parking: {
                status: request.status,
                reviewNote: request.reviewNote ?? '',
            },
        };

        this.smsNotification.triggerSms(NotificationEvent.ParkingRequestDecision, data).catch(() => { });
        this.emailNotification.triggerEmail(NotificationEvent.ParkingRequestDecision, data).catch(() => { });
    }

    async findByVisitVisitorIds(visitVisitorIds: string[]): Promise<ParkingRequest[]> {
        if (!visitVisitorIds.length) return [];
        return this.parkingRepo.createQueryBuilder('pr')
            .where('pr.visitVisitorId IN (:...ids)', { ids: visitVisitorIds })
            .andWhere('pr.isActive = :active', { active: true })
            .getMany();
    }

    async getPendingCount(): Promise<number> {
        return this.parkingRepo.count({
            where: { status: ParkingRequestStatus.Pending, isActive: true },
        });
    }
}
