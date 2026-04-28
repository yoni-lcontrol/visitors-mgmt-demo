import {
    Injectable,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Visitor } from './entities/visitor.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { Visit } from './entities/visit.entity';
import { Building } from '../buildings/entities/building.entity';
import { User } from '../users/entities/user.entity';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../common/utils/paginate.util';
import { toExcelBuffer } from '../common/utils/excel.util';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';
import { VisitorPersistenceService } from './visitor-persistence.service';
import { shouldRestrictVisitorsToOwn } from './visitor-role-policy';

export interface VisitorDirectoryContext {
    hostName: string | null;
    buildingName: string | null;
    floor: number | null;
}

export type VisitorDirectoryItem = Visitor & VisitorDirectoryContext;

@Injectable()
export class VisitorsService {
    constructor(
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
        private readonly visitorPersistence: VisitorPersistenceService,
        private readonly wsGateway: UsersGateway,
        private readonly auditService: AuditService,
    ) { }

    async findAll(
        query: PaginationQueryDto,
        currentUserId?: string,
        userRoles?: string[],
    ): Promise<PaginatedResult<VisitorDirectoryItem>> {
        const result = await paginateQuery(this.buildFindAllQuery(query, currentUserId, userRoles), query.page, query.limit);
        const items = await this.enrichVisitorsWithLatestVisitContext(result.items);
        return { ...result, items };
    }

    async exportToExcel(
        query: PaginationQueryDto,
        currentUserId?: string,
        userRoles?: string[],
    ): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query, currentUserId, userRoles);
        const items = await qb.getMany();
        const withContext = await this.enrichVisitorsWithLatestVisitContext(items);
        const contextById = new Map(withContext.map((item) => [item.id, item]));
        const rows = items.map((v) => ({
            visitorName: `${v.firstName} ${v.lastName}`.trim(),
            personId: v.personId,
            phone: v.phone ?? '',
            vehicleType: v.vehicleType ?? '',
            carNumber: v.carNumber ?? '',
            building: contextById.get(v.id)?.buildingName ?? '',
            floor: contextById.get(v.id)?.floor ?? '',
            hostName: contextById.get(v.id)?.hostName ?? '',
        }));
        return toExcelBuffer(rows, 'Visitors');
    }

    private buildFindAllQuery(
        query: PaginationQueryDto,
        currentUserId?: string,
        userRoles?: string[],
    ) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.visitorRepo
            .createQueryBuilder('v')
            .where('v.isActive = :active', { active: true });

        this.applyOwnershipScope(qb, currentUserId, userRoles);

        if (search) {
            qb.andWhere(
                '(v.firstName LIKE :s OR v.lastName LIKE :s OR v.email LIKE :s OR v.phone LIKE :s OR v.personId LIKE :s OR v.carNumber LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            firstName: 'v.firstName',
            lastName: 'v.lastName',
            email: 'v.email',
            phone: 'v.phone',
            personId: 'v.personId',
            carNumber: 'v.carNumber',
            vehicleType: 'v.vehicleType',
        });

        const sortable: Record<string, string> = {
            firstName: 'v.firstName',
            lastName: 'v.lastName',
            email: 'v.email',
            phone: 'v.phone',
            personId: 'v.personId',
            carNumber: 'v.carNumber',
            vehicleType: 'v.vehicleType',
            createdAt: 'v.createdAt',
            updatedAt: 'v.updatedAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'v.createdAt', sortOrder ?? 'DESC');
        return qb;
    }

    async searchByPersonId(
        prefix: string,
        currentUserId?: string,
        userRoles?: string[],
    ): Promise<Pick<Visitor, 'id' | 'firstName' | 'lastName' | 'personId' | 'phone' | 'email' | 'carNumber' | 'vehicleType'>[]> {
        if (!prefix || prefix.trim().length < 4) return [];

        const sanitized = prefix.trim();
        const qb = this.visitorRepo
            .createQueryBuilder('v')
            .select(['v.id', 'v.firstName', 'v.lastName', 'v.personId', 'v.phone', 'v.email', 'v.carNumber', 'v.vehicleType'])
            .where('v.isActive = :active', { active: true })
            .andWhere('v.personId LIKE :prefix', { prefix: `${sanitized}%` })
            .orderBy('v.personId', 'ASC')
            .take(10);

        this.applyOwnershipScope(qb, currentUserId, userRoles);

        const visitors = await qb.getMany();

        return visitors;
    }

    async findById(id: string, currentUserId?: string, userRoles?: string[]): Promise<Visitor> {
        const qb = this.visitorRepo
            .createQueryBuilder('v')
            .where('v.id = :id', { id })
            .andWhere('v.isActive = :active', { active: true });

        this.applyOwnershipScope(qb, currentUserId, userRoles);

        const visitor = await qb.getOne();
        if (!visitor) throw new NotFoundException('Visitor not found');
        return visitor;
    }

    async create(dto: CreateVisitorDto, currentUserId?: string): Promise<Visitor> {
        const { visitor, action } = await this.visitorPersistence.upsertByPersonId(dto, currentUserId);
        const result = await this.findById(visitor.id);

        this.wsGateway.broadcastToAll(
            action === 'created' ? 'visitors:visitor:created' : 'visitors:visitor:updated',
            { id: result.id, firstName: result.firstName, lastName: result.lastName },
        );

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: action === 'created' ? 'CREATE' : 'UPDATE',
            entity: 'Visitor',
            entityId: visitor.id,
            description: `${action === 'created' ? 'Created' : 'Updated'} visitor "${result.firstName} ${result.lastName}"`,
            newValue: { firstName: dto.firstName, lastName: dto.lastName, personId: dto.personId },
        }).catch(() => { });

        return result;
    }

    async update(id: string, dto: UpdateVisitorDto, currentUserId?: string, userRoles?: string[]): Promise<Visitor> {
        const visitor = await this.findById(id, currentUserId, userRoles);
        const oldValue = { firstName: visitor.firstName, lastName: visitor.lastName, personId: visitor.personId, email: visitor.email, phone: visitor.phone };
        const normalizedPersonId = dto.personId !== undefined
            ? this.visitorPersistence.normalizePersonId(dto.personId)
            : undefined;
        if (normalizedPersonId && normalizedPersonId !== visitor.personId) {
            const existing = await this.visitorPersistence.findByPersonId(normalizedPersonId);
            if (existing && existing.id !== visitor.id) {
                throw new ConflictException('Visitor personId already exists');
            }
        }

        if (dto.firstName !== undefined) visitor.firstName = dto.firstName.trim();
        if (dto.lastName !== undefined) visitor.lastName = dto.lastName.trim();
        if (dto.email !== undefined) visitor.email = dto.email?.trim() ? dto.email.trim() : null;
        if (dto.phone !== undefined) visitor.phone = dto.phone.trim();
        if (normalizedPersonId !== undefined) visitor.personId = normalizedPersonId;
        if (dto.carNumber !== undefined) visitor.carNumber = dto.carNumber?.trim() ? dto.carNumber.trim() : null;
        if (dto.vehicleType !== undefined) visitor.vehicleType = dto.vehicleType?.trim() ? dto.vehicleType.trim() : null;
        visitor.updatedBy = currentUserId ?? null;
        await this.visitorRepo.save(visitor);
        const result = await this.findById(id, currentUserId, userRoles);
        this.wsGateway.broadcastToAll('visitors:visitor:updated', { id: result.id, firstName: result.firstName, lastName: result.lastName });

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'UPDATE',
            entity: 'Visitor',
            entityId: id,
            description: `Updated visitor "${result.firstName} ${result.lastName}"`,
            oldValue,
            newValue: dto,
        }).catch(() => { });

        return result;
    }

    async remove(id: string, currentUserId?: string, userRoles?: string[]): Promise<void> {
        const visitor = await this.findById(id, currentUserId, userRoles);
        visitor.isActive = false;
        visitor.updatedBy = currentUserId ?? null;
        await this.visitorRepo.save(visitor);
        this.wsGateway.broadcastToAll('visitors:visitor:deleted', { id });

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'DELETE',
            entity: 'Visitor',
            entityId: id,
            description: `Deleted visitor "${visitor.firstName} ${visitor.lastName}"`,
        }).catch(() => { });
    }

    private applyOwnershipScope(
        qb: SelectQueryBuilder<Visitor>,
        currentUserId?: string,
        userRoles?: string[],
    ): void {
        if (!shouldRestrictVisitorsToOwn(userRoles)) {
            return;
        }

        if (!currentUserId) {
            qb.andWhere('1 = 0');
            return;
        }

        const ownVisitSubQuery = qb
            .subQuery()
            .select('1')
            .from(VisitVisitor, 'vv_scope')
            .innerJoin(Visit, 'vis_scope', 'vis_scope.id = vv_scope.visitId AND vis_scope.isActive = :visitScopeActive')
            .where('vv_scope.visitorId = v.id')
            .andWhere('vv_scope.isActive = :vvScopeActive')
            .andWhere('(vis_scope.createdByUserId = :currentUserId OR vis_scope.visitRequesterUserId = :currentUserId)')
            .getQuery();

        qb.andWhere(`(v.createdBy = :currentUserId OR EXISTS ${ownVisitSubQuery})`, {
            currentUserId,
            vvScopeActive: true,
            visitScopeActive: true,
        });
    }

    private async enrichVisitorsWithLatestVisitContext(
        visitors: Visitor[],
    ): Promise<VisitorDirectoryItem[]> {
        if (visitors.length === 0) {
            return [];
        }

        const visitorIds = visitors.map((visitor) => visitor.id);
        const rows = await this.visitorRepo.manager
            .createQueryBuilder(VisitVisitor, 'vv')
            .innerJoin(Visit, 'visit', 'visit.id = vv.visitId AND visit.isActive = :visitActive', { visitActive: true })
            .leftJoin(Building, 'building', 'building.id = visit.buildingId')
            .leftJoin(User, 'creator', 'creator.id = visit.createdByUserId')
            .select('vv.visitorId', 'visitorId')
            .addSelect('building.name', 'buildingName')
            .addSelect('visit.floor', 'floor')
            .addSelect('visit.visitRequesterFirstName', 'visitRequesterFirstName')
            .addSelect('visit.visitRequesterLastName', 'visitRequesterLastName')
            .addSelect('creator.firstName', 'creatorFirstName')
            .addSelect('creator.lastName', 'creatorLastName')
            .where('vv.isActive = :active', { active: true })
            .andWhere('vv.visitorId IN (:...visitorIds)', { visitorIds })
            .orderBy('vv.visitorId', 'ASC')
            .addOrderBy('visit.plannedStartTimeUtc', 'DESC')
            .addOrderBy('visit.createdAt', 'DESC')
            .getRawMany<{
                visitorId: string;
                buildingName: string | null;
                floor: number | string | null;
                visitRequesterFirstName: string | null;
                visitRequesterLastName: string | null;
                creatorFirstName: string | null;
                creatorLastName: string | null;
            }>();

        const contextByVisitorId = new Map<string, VisitorDirectoryContext>();
        for (const row of rows) {
            if (!row.visitorId || contextByVisitorId.has(row.visitorId)) {
                continue;
            }

            const floorValue = row.floor === null || row.floor === undefined || row.floor === ''
                ? null
                : Number(row.floor);

            contextByVisitorId.set(row.visitorId, {
                buildingName: row.buildingName ?? null,
                floor: Number.isNaN(floorValue) ? null : floorValue,
                hostName: this.resolveHostName(
                    row.visitRequesterFirstName,
                    row.visitRequesterLastName,
                    row.creatorFirstName,
                    row.creatorLastName,
                ),
            });
        }

        return visitors.map((visitor) => {
            const context = contextByVisitorId.get(visitor.id) ?? {
                hostName: null,
                buildingName: null,
                floor: null,
            };

            return {
                ...visitor,
                ...context,
            };
        });
    }

    private resolveHostName(
        requesterFirstName: string | null,
        requesterLastName: string | null,
        creatorFirstName: string | null,
        creatorLastName: string | null,
    ): string | null {
        const requesterName = `${requesterFirstName ?? ''} ${requesterLastName ?? ''}`.trim();
        if (requesterName) {
            return requesterName;
        }

        const creatorName = `${creatorFirstName ?? ''} ${creatorLastName ?? ''}`.trim();
        return creatorName || null;
    }
}
