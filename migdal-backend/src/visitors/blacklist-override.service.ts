import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { BlacklistOverrideStatus } from './enums/blacklist-override-status.enum';
import { BlacklistOverrideQueryDto } from './dto/blacklist-override-query.dto';
import { ReviewBlacklistOverrideDto } from './dto/review-blacklist-override.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BlacklistOverrideService {
    constructor(
        @InjectRepository(BlacklistOverrideRequest)
        private readonly overrideRepo: Repository<BlacklistOverrideRequest>,
        private readonly auditService: AuditService,
    ) {}

    async findAll(query: BlacklistOverrideQueryDto): Promise<PaginatedResult<any>> {
        const { page = 1, limit = 20, status, search, sortBy, sortOrder, filters } = query;

        const qb = this.overrideRepo.createQueryBuilder('bor')
            .innerJoinAndSelect('bor.visitVisitor', 'vv')
            .innerJoinAndSelect('vv.visitor', 'vis')
            .innerJoinAndSelect('vv.visit', 'visit')
            .leftJoinAndSelect('visit.createdByUser', 'creator')
            .leftJoinAndSelect('bor.reviewedByUser', 'reviewer')
            .where('bor.isActive = :active', { active: true });

        if (status) {
            qb.andWhere('bor.status = :status', { status });
        }
        if (search) {
            qb.andWhere(
                '(vis.firstName LIKE :s OR vis.lastName LIKE :s OR vis.personId LIKE :s OR visit.title LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            visitorName: 'vis.firstName',
            visitTitle: 'visit.title',
            createdBy: 'creator.firstName',
            createdAt: 'bor.createdAt',
            reviewedBy: 'reviewer.firstName',
        });

        const sortable: Record<string, string> = {
            createdAt: 'bor.createdAt',
            status: 'bor.status',
            visitorName: 'vis.firstName',
            visitTitle: 'visit.title',
            createdBy: 'creator.firstName',
            reviewedBy: 'reviewer.firstName',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'bor.createdAt', sortOrder ?? 'DESC');

        const total = await qb.getCount();
        const items = await qb.skip((page - 1) * limit).take(limit).getMany();

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async review(id: string, dto: ReviewBlacklistOverrideDto, currentUserId: string): Promise<BlacklistOverrideRequest> {
        const request = await this.overrideRepo.findOne({
            where: { id, isActive: true },
            relations: ['visitVisitor', 'visitVisitor.visitor', 'visitVisitor.visit'],
        });
        if (!request) {
            throw new NotFoundException('Blacklist override request not found');
        }

        const previousStatus = request.status;

        request.status = dto.status;
        request.reviewedByUserId = currentUserId;
        request.reviewedAt = new Date();
        request.reviewNote = dto.reviewNote ?? null;
        request.updatedBy = currentUserId;

        const saved = await this.overrideRepo.save(request);

        const visitor = request.visitVisitor?.visitor;
        const auditAction = dto.status === BlacklistOverrideStatus.Approved
            ? 'BLACKLIST_OVERRIDE_APPROVED'
            : 'BLACKLIST_OVERRIDE_DENIED';
        const visitorName = visitor
            ? [visitor.firstName, visitor.lastName].filter(Boolean).join(' ')
            : '';
        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: auditAction,
            entity: 'BlacklistOverrideRequest',
            entityId: id,
            description: `Blacklist override ${dto.status} for visitor ${visitorName}`.trim(),
            oldValue: { status: previousStatus },
            newValue: { status: dto.status, reviewNote: dto.reviewNote ?? null },
        }).catch(() => {});

        return saved;
    }

    async findByVisitVisitorIds(visitVisitorIds: string[]): Promise<BlacklistOverrideRequest[]> {
        if (!visitVisitorIds.length) return [];
        return this.overrideRepo.createQueryBuilder('bor')
            .where('bor.visitVisitorId IN (:...ids)', { ids: visitVisitorIds })
            .andWhere('bor.isActive = :active', { active: true })
            .getMany();
    }

    async getPendingCount(): Promise<number> {
        return this.overrideRepo.count({
            where: { status: BlacklistOverrideStatus.Pending, isActive: true },
        });
    }
}
